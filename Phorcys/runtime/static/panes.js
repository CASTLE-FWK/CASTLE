'use strict';

// https://github.com/szym/display
// Copyright (c) 2016, Szymon Jakubczak (MIT License)
// Based on https://github.com/chjj/tty.js by Christopher Jeffrey

(function() {

///////////////////
// Global Elements
'use strict';
var document = this.document
  , window = this
  , root
  , body;

///////////
// Helpers

function on(el, type, handler, capture) {
  el.addEventListener(type, handler, capture || false);
}

function off(el, type, handler, capture) {
  el.removeEventListener(type, handler, capture || false);
}

function cancel(ev) {
  if (ev.preventDefault) {
    ev.preventDefault();
  }
  ev.returnValue = false;
  if (ev.stopPropagation) {
    ev.stopPropagation();
  }
  ev.cancelBubble = true;
  return false;
}

function extend(dst, src) {
  for (var k in src)
    if (src.hasOwnProperty(k))
      dst[k] = src[k];
  return dst;
}

////////
// Pane

var panes = {};

function getPane(id, ctor) {
  if (typeof id === 'undefined') id = Math.random().toString(36).substring(7);
  var pane = panes[id];
  if (!(pane instanceof ctor)) {
    if (pane) pane.destroy(true);
    pane = new ctor(id);
  }
  return pane;
}

function findPlacement() {
  var rects = [];
  for (var p in panes) {
    if (!panes.hasOwnProperty(p)) continue;
    p = panes[p];
    if (p.minimize) p.minimize();
    var el = p.element;
    var rect = [ el.offsetLeft, el.offsetTop,
                 el.offsetLeft + el.offsetWidth, el.offsetTop + el.offsetHeight ];
    rects.push(rect);
  }

  if (rects.length == 0) return {};

  function overlap(rect) {
    var total = 0;
    for (var i = 0; i < rects.length; ++i) {
      var other = rects[i];
      total += Math.max(0, Math.min(other[2] - rect[0], rect[2] - other[0])) *
               Math.max(0, Math.min(other[3] - rect[1], rect[3] - other[1]));
    }
    return total;
  }

  // Try random location a few times; pick the one with smallest overlap.
  var MAX_TRIES = 4;
  var width = 400, height = 300;  // assumed width/height
  var best = { overlap: Infinity };
  for (var i = 0; i < MAX_TRIES; ++i) {
    var x = Math.random() * (root.clientWidth - width), y = Math.random() * (root.clientHeight - height);
    var candidate = [ x, y, x + width, y + height ];
    var over = overlap(candidate);
    if (over < best.overlap || (over <= best.overlap && (x < best.rect[0] || y < best.rect[1])))
        best = { overlap: over, rect: candidate };
  }

  return {
    left: best.rect[0] + 'px',
    top: best.rect[1] + 'px',
  };
}

function Pane(id) {
  var self = this;

  var el = document.createElement('div');
  el.className = 'window';

  var grip = document.createElement('div');
  grip.className = 'grip';

  var bar = document.createElement('div');
  bar.className = 'bar';

  var closeButton = document.createElement('button');
  closeButton.innerHTML = 'x';
  closeButton.title = 'close';

  var cloneButton = document.createElement('button');
  cloneButton.innerHTML = '-';
  cloneButton.title = 'disconnect';

  var title = document.createElement('div');
  title.className = 'title';

  var content = document.createElement('div');
  content.className = 'content';

  this.id = id;
  this.element = el;
  this.bar = bar;
  this.grip = grip;
  this.title = title;
  this.content = content;

  el.appendChild(grip);
  el.appendChild(bar);
  el.appendChild(content);
  bar.appendChild(closeButton);
  bar.appendChild(cloneButton);
  bar.appendChild(title);
  body.appendChild(el);

  on(closeButton, 'click', function(ev) {
    self.destroy();
    return cancel(ev);
  });

  on(cloneButton, 'click', function(ev) {
    bar.removeChild(cloneButton);
    self.id = id + Math.random();
    self.title.innerHTML += ' (offline)';
    delete panes[id];
    panes[self.id] = self;
    return cancel(ev);
  });

  on(grip, 'mousedown', function(ev) {
    self.focus();
    self.resizing(ev);
    return cancel(ev);
  });

  on(el, 'mousedown', function(ev) {
    if (ev.target.nodeName === "BUTTON") return true;
    self.focus();
    if (ev.target !== el && ev.target !== bar && ev.target !== title) return true;
    self.drag(ev);
    return cancel(ev);
  });

  on(bar, 'dblclick', function(ev) {
    self.maximize();
  });

  this.focus();

  var position = JSON.parse(localStorage.getItem(id) || 'false') || findPlacement();
  if (position.maximized) {
    this.maximize();
  } else {
    el.style.left = position.left;
    el.style.top = position.top;
    el.style.width = position.width;
    el.style.height = position.height;
  }

  panes[id] = this;
}

Pane.prototype = {
  setTitle: function(title) {
    this.title.innerHTML = title;
  },

  focus: function() {
    // Restack, but only if not already last.
    // Otherwise, dblclick won't work.
    if (!this.element.nextSibling) return;
    var parent = this.element.parentNode;
    if (parent) {
      parent.removeChild(this.element);
      parent.appendChild(this.element);
    }
  },

  save: function() {
    var el = this.element;
    var position = {
      left: el.style.left,
      top: el.style.top,
      width: el.style.width,
      height: el.style.height,
      maximized: false, // ('minimize' in this),
    };
    localStorage.setItem(this.id, JSON.stringify(position));
  },

  destroy: function(keepPosition) {
    if (this.destroyed) return;
    this.destroyed = true;

    delete panes[this.id];
    this.element.parentNode.removeChild(this.element);
    if (!keepPosition)
      localStorage.removeItem(this.id);
  },

  drag: function(ev) {
    var self = this
      , el = this.element;

    if (this.minimize) return;

    var anchor = {
      x: ev.pageX - el.offsetLeft,
      y: ev.pageY - el.offsetTop,
    };

    el.style.opacity = '0.60';
    root.style.cursor = 'move';

    function move(ev) {
      el.style.left = (ev.pageX - anchor.x) + 'px';
      el.style.top = Math.max(0, ev.pageY - anchor.y) + 'px';
    }

    function up() {
      el.style.opacity = '';
      root.style.cursor = '';

      off(document, 'mousemove', move);
      off(document, 'mouseup', up);
      self.save();
    }

    on(document, 'mousemove', move);
    on(document, 'mouseup', up);
  },

  resizing: function(ev) {
    var self = this
      , el = this.element;

    delete this.minimize;

    var anchor = {
      x: ev.pageX - el.offsetWidth,
      y: ev.pageY - el.offsetHeight,
    };

    el.style.opacity = '0.70';
    root.style.cursor = 'se-resize';

    function move(ev) {
      el.style.width = (ev.pageX - anchor.x) + 'px';
      el.style.height = (ev.pageY - anchor.y) + 'px';
    }

    function up(ev) {
      el.style.opacity = '';
      root.style.cursor = '';
      off(document, 'mousemove', move);
      off(document, 'mouseup', up);
      self.save();
      if (self.onresize) self.onresize();
    }

    on(document, 'mousemove', move);
    on(document, 'mouseup', up);
  },

  maximize: function() {
    if (this.minimize) return this.minimize();

    var self = this
      , el = this.element
      , grip = this.grip;

    var m = {
      left: el.offsetLeft,
      top: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
    };

    this.minimize = function() {
      delete self.minimize;

      el.style.left = m.left + 'px';
      el.style.top = m.top + 'px';
      el.style.width = m.width + 'px';
      el.style.height = m.height + 'px';
      grip.style.display = '';
      self.save();
      if (self.onresize) self.onresize();
    };

    window.scrollTo(0, 0);

    el.style.left = '0px';
    el.style.top = '0px';
    el.style.width = '100%';
    el.style.height = '100%';
    grip.style.display = 'none';
    self.save();
    if (self.onresize) self.onresize();
  },
};

//////////////////////
// Built-in Pane types

function ImagePane(id) {
  Pane.call(this, id);

  var self = this
    , content = this.content;

  var image = document.createElement('img');
  image.className = 'content-image';
  content.appendChild(image);

  var labels = document.createElement('div');
  labels.className = 'labels';
  content.appendChild(labels);

  this.content = image;
  this.labels = labels;
  this.width = 0;
  this.height = 0;
  this.scale = 1;

  on(content, 'wheel', function(ev) {
    self.zoom(ev);
    return cancel(ev);
  });

  on(content, 'mousedown', function(ev) {
    self.focus();
    self.panContent(ev);
    return cancel(ev);
  });

  on(content, 'dblclick', function(ev) {
    if (self.content.style.width) {
      self.reset();
    } else {
      self.fullzoom();
    }
    return cancel(ev);
  });

  on(image, 'load', function(ev) {
    if ((image.naturalWidth != self.width) || (image.naturalHeight != self.height)) {
      self.width = image.naturalWidth;
      self.height = image.naturalHeight;
      self.reset();
    }
  });
}

ImagePane.prototype = extend(Object.create(Pane.prototype), {
  resizeLabels: function() {
    // Note, we want to keep natural font, so don't use transforms.
    this.labels.style.left = this.content.offsetLeft + 'px';
    this.labels.style.top = this.content.offsetTop + 'px';
    this.labels.style.width = this.content.offsetWidth + 'px';
    this.labels.style.height = this.content.offsetHeight + 'px'
  },

  reset: function() {
    var el = this.element
      , c = this.content;

    c.style.left = '';
    c.style.top = '';
    c.style.width ='';
    c.style.height = '';
    this.resizeLabels();
    this.scale = Math.min(el.offsetWidth / c.naturalWidth, el.offsetHeight / c.naturalHeight);
  },

  fullzoom: function() {
    var el = this.element
      , c = this.content;

    c.style.left = '0';
    c.style.top = '0';
    this.scale = Math.min(el.offsetWidth / c.naturalWidth, el.offsetHeight / c.naturalHeight);
    c.style.width = this.width * this.scale + 'px';
    c.style.height = this.height * this.scale + 'px';
    this.resizeLabels();
  },

  moveContent: function(left, top) {
    var el = this.element
      , content = this.content;

    if (!content.style.position) {
      // Until the content is first moved, it is positioned statically, so remember current size in |el|.
      el.style.width = Math.min(root.clientWidth - el.offsetLeft, el.offsetWidth) + 'px';
      el.style.height = Math.min(root.clientHeight - el.offsetTop, el.offsetHeight) + 'px';
      content.style.position = 'absolute';
    }
    // TODO: use CSS transforms instead of left/top/width/height
    content.style.left = Math.min(el.offsetWidth - 20,
                           Math.max(20 - content.offsetWidth, left)) + 'px';
    content.style.top = Math.min(el.offsetHeight - this.bar.offsetHeight - 20,
                          Math.max(20 - content.offsetHeight, top)) + 'px';
    this.resizeLabels();
  },

  zoom: function(ev) {
    var el = this.element
      , content = this.content;

    var delta = (ev.deltaMode === ev.DOM_DELTA_PIXEL) ? ev.deltaY : ev.deltaY * 40;
    var scale = Math.exp(delta / 800.0);

    // Don't shrink below 100px.
    if (content.offsetWidth * scale < 100) scale = 100 / content.offsetWidth;

    this.scale *= scale;

    content.style.width = this.width * this.scale + 'px';
    content.style.height = this.height * this.scale + 'px';

    var layerX = ev.clientX - content.offsetLeft - el.offsetLeft;
    var layerY = ev.clientY - content.offsetTop - el.offsetTop - this.bar.offsetHeight;

    this.moveContent(content.offsetLeft + (1 - scale) * layerX,
                     content.offsetTop + (1 - scale) * layerY);
  },

  panContent: function(ev) {
    var self = this
      , content = this.content;

    var anchor = {
      x: ev.pageX - content.offsetLeft,
      y: ev.pageY - content.offsetTop,
    };

    content.style.cursor = 'move';

    function move(ev) {
      self.moveContent(ev.pageX - anchor.x, ev.pageY - anchor.y);
    }

    function up(ev) {
      move(ev);

      content.style.cursor = '';
      off(document, 'mousemove', move);
      off(document, 'mouseup', up);
    }

    on(document, 'mousemove', move);
    on(document, 'mouseup', up);
  },

  setContent: function(content) {
    // Hack around unexpected behavior. Setting .src resets .style (except 'position: absolute').
    var oldCss = this.content.style.cssText;
    this.content.src = content.src;
    this.content.style.cssText = oldCss;
    if (this.content.style.cssText != oldCss) {
      this.content.style.cssText = oldCss;
    }
    if (content.width) {
      if (this.content.width != content.width) {
        this.content.width = content.width;
        this.reset();
      }
    } else {
      this.content.removeAttribute('width');
    }
    this.labels.innerHTML = '';
    var labels = content.labels || [];
    for (var i = 0; i < labels.length; ++i) {
      var a = labels[i];  // [x, y, text]
      var ae = document.createElement('div');
      ae.className = 'label';
      ae.style.left = a[0] < 1 ? (a[0] * 100 + '%') : (a[0] + 'px');
      ae.style.top = a[1] < 1 ? (a[1] * 100 + '%') : (a[1] + 'px');
      ae.innerHTML = a[2];
      this.labels.appendChild(ae);
    }
    
  },
});


function getTickResolution(graph) {
  var range = graph.yAxisRange(0);
  var area = graph.getArea();
  var maxTicks = area.h / graph.getOptionForAxis('pixelsPerLabel', 'y');
  var tickSize = (range[1] - range[0]) / maxTicks;
  return Math.floor(Math.log10(tickSize));
}

//TODO: Remove DyGraph dependency and replace with visJS
function PlotPane(id) {
  Pane.call(this, id);

  this.element.className += ' window-plot';
  if (!this.element.style.height)
     this.element.style.height = '200px';
  this.content.className += ' content-plot';

  // Use undefined initial data to avoid anything being drawn until setContent.
  var graph = this.graph = new Dygraph(this.content, undefined, {
    axes: {
      y: {
        valueFormatter: function(y) {
          var resolution = getTickResolution(graph);
          return y.toFixed(Math.max(0, -resolution + 1));
        },
        axisLabelFormatter: function(y) {
          var resolution = getTickResolution(graph);
          return y.toFixed(Math.max(0, -resolution));
        },
      },
    },
  });
}

PlotPane.prototype = extend(Object.create(Pane.prototype), {
  onresize: function() {
    this.graph.resize();
  },

  setContent: function(opts) {
    this.graph.updateOptions(opts);
  },
});

function TextPane(id) {
  Pane.call(this, id);

  var self = this;
  var content = this.content;
  var txt = document.createElement('p');
  txt.className = 'content-text';
  content.appendChild(txt);
  this.content = txt;
}

TextPane.prototype = extend(Object.create(Pane.prototype), {
  setContent: function(txt) {
    this.content.innerHTML = txt;
  },
});

function AudioPane(id) {
  Pane.call(this, id);

  var self = this;
  var content = this.content;
  var audio = document.createElement('audio');
  audio.className = 'content-audio';
  audio.controls = true;
  audio.autoplay = true;
  content.appendChild(audio);
  this.content = audio;
}


function MeshPane(id) {
    Pane.call(this, id);

    var self = this;
    var content = this.content;
    var txt = document.createElement('p');

    this.scene = new THREE.Scene();
    var scene = this.scene;
    var camera, renderer, stats;
    var geometry, material, mesh;
    var light, controls;
    var width  = 400;
    var height = 400;

    this.element.style.height = height + 'px';
    this.element.style.width = width + 'px';

    function init(element) {

        camera = new THREE.PerspectiveCamera( 75, width / height, 1, 10000 );
        camera.position.z = 1000;
        renderer = new THREE.WebGLRenderer({alpha: true});
        renderer.setClearColor(0xffffff,1); //White BG
        renderer.setSize( width, height );

        controls = new THREE.OrbitControls( camera, renderer.domElement );
        //controls.addEventListener( 'change', render ); // add this only if there is no animation loop (requestAnimationFrame)
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        controls.enableZoom = true;

        var geometry = new THREE.CylinderGeometry( 0, 10, 30, 4, 1 );
        var material =  new THREE.MeshPhongMaterial( { color:0xffffff, shading: THREE.FlatShading } );

        // lights
        light = new THREE.DirectionalLight( 0xffffff );
        light.position.set( 1, 1, 1 );
        scene.add( light );

        light = new THREE.DirectionalLight( 0x002288 );
        light.position.set( -1, -1, -1 );
        scene.add( light );

        light = new THREE.AmbientLight( 0x222222 );
        scene.add( light );

        //

        //stats = new Stats();
        //stats.domElement.style.position = 'absolute';
        //stats.domElement.style.top = '0px';
        //stats.domElement.style.zIndex = 100;
        //container.appendChild( stats.domElement );
        self.scene = scene;
        self.camera = camera;
        element.appendChild( renderer.domElement );
    }

    function onWindowResize() {

        self.width = content.clientWidth;
        self.height = content.clientHeight;
        camera.aspect = width / height;

        camera.updateProjectionMatrix();
        renderer.setSize( self.width, self.height );
    }

    function animate() {
        requestAnimationFrame( animate );
        controls.update(); // required if controls.enableDamping = true, or if controls.autoRotate = true
        render();
    }

    function render() {
        renderer.render( scene, camera );
    }

    init(content);
    animate();

    on(content, 'mousedown', function(ev) {
       onWindowResize();
      });
    render();
    //content.appendChild(txt);
    //content.appendChild(script_tag);

    this.content = renderer.domElement;
}

MeshPane.prototype = extend(Object.create(Pane.prototype), {
  setContent: function(opts) {
    // var geometry = new THREE.CylinderGeometry( 0, 10, 30, 4, 1 );
    // TODO: Make the API do an init call to set geometry of things (or we can do below)
    var geometry = new THREE.BoxGeometry(20,20,20);
    var material =  new THREE.MeshPhongMaterial( { color:0xffffff, shading: THREE.FlatShading } );
    //this.content.innerHTML = txt;

    if (opts.file.length > 0){

      var in_arr = opts.file;
      var length = in_arr.length;

      for (var i = 0; i < length; i++){
        var currObj = this.scene.getObjectByName(in_arr[i][0]);
        if (currObj == null){
          var mesh;
          if (in_arr[i][4] != null){
            mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial( { color:new THREE.Color(in_arr[i][4]), shading: THREE.FlatShading } ) );
          } else {
            mesh = new THREE.Mesh(geometry, material);
          }
          mesh.name = in_arr[i][0];
          mesh.position.x = in_arr[i][1] * 1000;
          mesh.position.y = in_arr[i][2] * 1000;
          mesh.position.z = in_arr[i][3] * 1000;

          // console.log("mesh x,y,z" + in_arr[i][1]+","+in_arr[i][2]+","+in_arr[i][3]);

          mesh.updateMatrix();
          mesh.matrixAutoUpdate = false;
          this.scene.add( mesh );
        } else {
          if (in_arr[i][4] != null){
            currObj.material = new THREE.MeshPhongMaterial( { color:new THREE.Color(in_arr[i][4]), shading: THREE.FlatShading } );
          } 
          currObj.position.x = in_arr[i][1] * 1000;
          currObj.position.y = in_arr[i][2] * 1000;
          currObj.position.z = in_arr[i][3] * 1000;

          currObj.updateMatrix();
          currObj.matrixAutoUpdate = false;
        }
      }

    } else {
      console.log("No data has been passed to MeshPane."); //Get Pane name??
/*      for ( var i = 0; i < 500; i ++ ) {
        var mesh = new THREE.Mesh( geometry, material );
        mesh.position.x = ( Math.random() - 0.5 ) * 1000;
        mesh.position.y = ( Math.random() - 0.5 ) * 1000;
        mesh.position.z = ( Math.random() - 0.5 ) * 1000;

        mesh.updateMatrix();
        mesh.matrixAutoUpdate = false;
        this.scene.add( mesh );
      }*/
    }
    //this.animate();
    //this.render();
  },
});

function IsosurfacePane(id) {
  Pane.call(this, id);

  var self = this;
  var content = this.content;

      // custom global variables

    var camera, renderer, stats;
    var geometry, material, mesh;
    var light, controls;
    var width  = 600;
    var height = 600;
    this.scene = new THREE.Scene();
    var scene = this.scene;

    this.element.style.height = height + 'px';
    this.element.style.width = width + 'px';

    var VIEW_ANGLE = 45, ASPECT = width / height, NEAR = 0.1, FAR = 20000;
    camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR);
    this.scene.add(camera);
    camera.position.set(20,20,60);
    camera.lookAt(this.scene.position);

    // RENDERER
    renderer = new THREE.WebGLRenderer();
    //renderer = new THREE.CanvasRenderer();

    renderer.setSize(width, height);
    renderer.setClearColor( 0xe6e6e6 );

    // CONTROLS
    controls = new THREE.OrbitControls( camera, renderer.domElement );

    // LIGHT
    light = new THREE.PointLight(0xcccccc);
    light.position.set(50,50,50);

    var ambientLight = new THREE.AmbientLight( 0x303030 );
    scene.add( ambientLight );

    this.scene.add(light);

    this.scene.add( new THREE.AxisHelper(100) );
    content.appendChild( renderer.domElement );

    function onWindowResize() {

        self.width = content.clientWidth;
        self.height = content.clientHeight;
        camera.aspect = width / height;

        camera.updateProjectionMatrix();
        renderer.setSize( self.width, self.height );
    }

    function animate() {
        requestAnimationFrame( animate );
        controls.update(); // required if controls.enableDamping = true, or if controls.autoRotate = true
        render();
    }
    function render() {
        renderer.render( scene, camera );
    }

    render();
    animate();
    on(content, 'mousedown', function(ev) {
        onWindowResize();
    });

}

IsosurfacePane.prototype = extend(Object.create(Pane.prototype), {
  setContent: function(opts) {

        var points = [];
        var values = [];
        var size;

        console.log("ISOSURFACE Options");
        console.log(JSON.stringify(opts));
       // number of cubes along a side - This should be computed and send along with the data

      var data = opts.file;
      //console.log();

      size = data.length;

      //Same with this
        var axisMin = -(size/2);
        var axisMax =  size/2;
        var axisRange = axisMax - axisMin;

        // Generate a list of 3D points and values at those points - This is the data
        for (var k = 0; k < size; k++)
        for (var j = 0; j < size; j++)
        for (var i = 0; i < size; i++)
        {
            // actual values - centres the object
            var x = axisMin + axisRange * i / (size - 1);
            var y = axisMin + axisRange * j / (size - 1);
            var z = axisMin + axisRange * k / (size - 1);

            points.push( new THREE.Vector3(x,y,z) );
            var value = data[i][j][k];
            values.push( value );
        }

        // Marching Cubes Algorithm

        var size2 = size * size;

        // Vertices may occur along edges of cube, when the values at the edge's endpoints
        //   straddle the isolevel value.
        // Actual position along edge weighted according to function values.
        var vlist = new Array(12);

        var geometry = new THREE.Geometry();
        var vertexIndex = 0;
        var isolevel = opts.threshold;

        //Move this into a Marching Cubes function??
        for (var z = 0; z < size - 1; z++)
        for (var y = 0; y < size - 1; y++)
        for (var x = 0; x < size - 1; x++)
        {
            // index of base point, and also adjacent points on cube
            var p    = x + size * y + size2 * z,
                px   = p   + 1,
                py   = p   + size,
                pxy  = py  + 1,
                pz   = p   + size2,
                pxz  = px  + size2,
                pyz  = py  + size2,
                pxyz = pxy + size2;

            // store scalar values corresponding to vertices
            var value0 = values[ p    ],
                value1 = values[ px   ],
                value2 = values[ py   ],
                value3 = values[ pxy  ],
                value4 = values[ pz   ],
                value5 = values[ pxz  ],
                value6 = values[ pyz  ],
                value7 = values[ pxyz ];

            // place a "1" in bit positions corresponding to vertices whose
            //   isovalue is less than given constant.


            var cubeindex = 0;
            if ( value0 < isolevel ) cubeindex |= 1;
            if ( value1 < isolevel ) cubeindex |= 2;
            if ( value2 < isolevel ) cubeindex |= 8;
            if ( value3 < isolevel ) cubeindex |= 4;
            if ( value4 < isolevel ) cubeindex |= 16;
            if ( value5 < isolevel ) cubeindex |= 32;
            if ( value6 < isolevel ) cubeindex |= 128;
            if ( value7 < isolevel ) cubeindex |= 64;

            // bits = 12 bit number, indicates which edges are crossed by the isosurface
            var bits = THREE.edgeTable[ cubeindex ];

            // if none are crossed, proceed to next iteration
            if ( bits === 0 ) continue;

            // check which edges are crossed, and estimate the point location
            //    using a weighted average of scalar values at edge endpoints.
            // store the vertex in an array for use later.
            var mu = 0.5;

            // bottom of the cube
            if ( bits & 1 )
            {
                mu = ( isolevel - value0 ) / ( value1 - value0 );
                vlist[0] = points[p].clone().lerp( points[px], mu );
            }
            if ( bits & 2 )
            {
                mu = ( isolevel - value1 ) / ( value3 - value1 );
                vlist[1] = points[px].clone().lerp( points[pxy], mu );
            }
            if ( bits & 4 )
            {
                mu = ( isolevel - value2 ) / ( value3 - value2 );
                vlist[2] = points[py].clone().lerp( points[pxy], mu );
            }
            if ( bits & 8 )
            {
                mu = ( isolevel - value0 ) / ( value2 - value0 );
                vlist[3] = points[p].clone().lerp( points[py], mu );
            }
            // top of the cube
            if ( bits & 16 )
            {
                mu = ( isolevel - value4 ) / ( value5 - value4 );
                vlist[4] = points[pz].clone().lerp( points[pxz], mu );
            }
            if ( bits & 32 )
            {
                mu = ( isolevel - value5 ) / ( value7 - value5 );
                vlist[5] = points[pxz].clone().lerp( points[pxyz], mu );
            }
            if ( bits & 64 )
            {
                mu = ( isolevel - value6 ) / ( value7 - value6 );
                vlist[6] = points[pyz].clone().lerp( points[pxyz], mu );
            }
            if ( bits & 128 )
            {
                mu = ( isolevel - value4 ) / ( value6 - value4 );
                vlist[7] = points[pz].clone().lerp( points[pyz], mu );
            }
            // vertical lines of the cube
            if ( bits & 256 )
            {
                mu = ( isolevel - value0 ) / ( value4 - value0 );
                vlist[8] = points[p].clone().lerp( points[pz], mu );
            }
            if ( bits & 512 )
            {
                mu = ( isolevel - value1 ) / ( value5 - value1 );
                vlist[9] = points[px].clone().lerp( points[pxz], mu );
            }
            if ( bits & 1024 )
            {
                mu = ( isolevel - value3 ) / ( value7 - value3 );
                vlist[10] = points[pxy].clone().lerp( points[pxyz], mu );
            }
            if ( bits & 2048 )
            {
                mu = ( isolevel - value2 ) / ( value6 - value2 );
                vlist[11] = points[py].clone().lerp( points[pyz], mu );
            }

            // construct triangles -- get correct vertices from triTable.
            var i = 0;
            cubeindex <<= 4;  // multiply by 16...
            // "Re-purpose cubeindex into an offset into triTable."
            //  since each row really isn't a row.

            // the while loop should run at most 5 times,
            //   since the 16th entry in each row is a -1.
            while ( THREE.triTable[ cubeindex + i ] != -1 )
            {
                var index1 = THREE.triTable[cubeindex + i];
                var index2 = THREE.triTable[cubeindex + i + 1];
                var index3 = THREE.triTable[cubeindex + i + 2];

                geometry.vertices.push( vlist[index1].clone() );
                geometry.vertices.push( vlist[index2].clone() );
                geometry.vertices.push( vlist[index3].clone() );
                var face = new THREE.Face3(vertexIndex, vertexIndex+1, vertexIndex+2);
                geometry.faces.push( face );

                geometry.faceVertexUvs[ 0 ].push( [ new THREE.Vector2(0,0), new THREE.Vector2(0,1), new THREE.Vector2(1,1) ] );

                vertexIndex += 3;
                i += 3;
            }
        }

        geometry.computeFaceNormals();
        geometry.computeVertexNormals();

        var colorMaterial =  new THREE.MeshLambertMaterial( {color: 0x0000ff, side: THREE.DoubleSide} );
        var mesh = new THREE.Mesh( geometry, colorMaterial );
        this.scene.add(mesh);

  },
});

function Graph3DPane(id){
  Pane.call(this, id);

  var self = this;
  var content = this.content;
  var visualisation = document.createElement('div');
  visualisation.id = "visualisation";
  content.appendChild(visualisation);

    // specify options
    this.options = {
        width:  '500px',
        height: '552px',
        style: 'surface',
        showPerspective: true,
        showGrid: true,
        showShadow: false,
        keepAspectRatio: true,
        verticalRatio: 0.5
    };

    // Instantiate our graph object.
    //var container = document.getElementById('visualisation');
    this.graph3d = new vis.Graph3d(visualisation);
    //content.appendChild(txt);
    //this.content = visualisation;
}

Graph3DPane.prototype = extend(Object.create(Pane.prototype), {
  setContent: function(opts) {
    //this.graph.updateOptions(opts);

    // Create and populate a data table.
    var data = new vis.DataSet();
    // create some nice looking data with sin/cos
    var counter = 0;
    var steps = 50;  // number of datapoints will be steps*steps
    var axisMax = 314;
    var axisStep = axisMax / steps;

    var in_arr = opts.file;
    var length = in_arr.length;
    var num_channels = in_arr[0].length;

    for(var i =0 ; i < length; i++) {

        var x = in_arr[i][0];
        var y = in_arr[i][1];
        var z = in_arr[i][2];
        data.add({id:i,x:x,y:y,z:z,style:z})
    }

    //data.add(opts.file);
    //console.log(JSON.stringify(opts));
    //console.log(JSON.stringify(opts.file));
    //console.log(JSON.stringify(this.options));
    //console.log(length.toString());
    //console.log(num_channels.toString());

    this.graph3d.setData(data);
    //this.graph3d._setOption(this.options)
  },

   onresize: function() {
    //This needs to be this.graph3d.setSize(pane.width, pane.height)
     //this.graph3d.redraw();
  },

});

//TODO: Make this look nicer, may have something to do with JSON type being passed
function NetworkPane(id){
  Pane.call(this,id);

  var self = this;
  var content = this.content;
  var visualisation = document.createElement('div'); //is this correct?
  visualisation.id = "networkVisualisation"; //is this correct?
  content.appendChild(visualisation);


  //Specify options
  this.options = {
    autoResize: false
    // height: '100%',
    // width: '100%',
    // // locale: 'en',
    // // locales: locales,
    // clickToUse: false
  };
  // this.options = {};

  this.network = new vis.Network(visualisation);
  this.network.setOptions(this.options);
}

NetworkPane.prototype = extend(Object.create(Pane.prototype), {
  setContent: function(opts) {
    var nodes = new vis.DataSet();
    var edges = new vis.DataSet();

    //Parse nodes first
    var nodesList = opts.nodes;
    for (var i = nodesList.length - 1; i >= 0; i--) {
      nodes.add({id:nodesList[i].id,label:nodesList[i].label})
    }

    //Parse edges
    var edgesList = opts.edges;
    for (var i = edgesList.length - 1; i >= 0; i--) {
      edges.add({from:edgesList[i].from,to:edgesList[i].to})
    }

    var data = {
      nodes: nodes,
      edges: edges
    };

    this.network.setData(data);
  }
});

//TODO: SimPane2D. What will this even look like
function SimPane2D(id){
  Pane.call(this.id);
}
SimPane2D.prototype = extend(Object.create(Pane.prototype), {

});

///////////////////
// Display "server"

var PaneTypes = {
  image: ImagePane,
  plot: PlotPane,
  text: TextPane,
  audio: AudioPane,
  mesh: MeshPane,
  isosurface: IsosurfacePane,
  graph3d: Graph3DPane,
  network: NetworkPane
}

var Commands = {
  pane: function(cmd) {
    var panetype = PaneTypes[cmd.type];
    if (!panetype) return
    var pane = getPane(cmd.id, panetype);
    if (cmd.title) pane.setTitle(cmd.title);
    pane.setContent(cmd.content);
  },
};

function connect() {
  var status = document.getElementById('status');
  var eventSource = new EventSource('events');

  on(eventSource, 'open', function(event) {
    status.className = 'online';
    status.innerHTML = 'online';
  });

  on(eventSource, 'error', function(event) {
    if (eventSource.readyState != eventSource.OPEN) {
      status.className = 'offline';
      status.innerHTML = 'error';
    }
  });

  on(eventSource, 'message', function(event) {
    var cmd = JSON.parse(event.data);
    var command = Commands[cmd.command];
    if (command) command(cmd);
  });

  return eventSource;
}

function load() {
  root = document.documentElement;
  body = document.body;

  var status = document.getElementById('status');
  var eventSource = connect();

  on(status, 'click', function(event) {
    if (status.className == 'online') {
      eventSource.close();
      status.className = 'offline';
      status.innerHTML = 'offline';
    } else {
      eventSource = connect();
    }
  });

  off(document, 'DOMContentLoaded', load);
}

on(document, 'DOMContentLoaded', load);

}).call(window);