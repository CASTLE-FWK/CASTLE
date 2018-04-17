#!/usr/bin/env python

import numpy as np
import random
import time

import base64
import json
import uuid
import sys

version = sys.version_info
if version.major == 2:
    import urllib2

    Request = urllib2.Request
    urlopen = urllib2.urlopen
else:
    import urllib.request

    Request = urllib.request.Request
    urlopen = urllib.request.urlopen

import Phorcys.png as png

__all__ = ['image', 'images', 'plot', 'text', 'mesh', 'isosurface', 'graph3d', 'networkGraph', 'volume']


# PORT = '8000'
# URL = 'http://localhost:' + PORT + '/events'

class rClient(object):
    def __init__(self, host="http://localhost", port=8000):
        self.host = host
        self.port = str(port)
        self.url = self.host + ":" + self.port + '/events'


session = rClient()


def uid():
    return 'pane_%s' % uuid.uuid4()


def update_session(new_session):
    session = new_session


def send(**command):
    command = json.dumps(command)
    # print("Command" + str(command))
    # req = Request(URL, 'POST')
    req = Request(session.url, 'POST')

    req.add_header('Content-Type', 'application/text')
    req.data = command.encode('ascii')
    try:
        resp = urlopen(req)
        return resp != None
    except:
        raise
        return False


def pane(panetype, win, title, content):
    win = win or uid()
    send(command='pane', type=panetype, id=win, title=title, content=content)
    return win


def normalize(img, opts):
    minval = opts.get('min')
    if minval is None:
        minval = np.amin(img)
    maxval = opts.get('max')
    if maxval is None:
        maxval = np.amax(img)

    return np.uint8((img - minval) * (255 / (maxval - minval)))


def to_rgb(img):
    nchannels = img.shape[2] if img.ndim == 3 else 1
    if nchannels == 3:
        return img
    if nchannels == 1:
        return img[:, :, np.newaxis].repeat(3, axis=2)
    raise ValueError('Image must be RGB or gray-scale')


def image(img, **opts):
    assert img.ndim == 2 or img.ndim == 3

    if isinstance(img, list):
        return images(img, opts)

    img = to_rgb(normalize(img, opts))
    pngbytes = png.encode(img.tostring(), img.shape[1], img.shape[0])
    imgdata = 'data:image/png;base64,' + base64.b64encode(pngbytes).decode('ascii')

    return pane('image', opts.get('win'), opts.get('title'), content={
        'src': imgdata,
        'labels': opts.get('labels'),
        'width': opts.get('width'),
    })


def image_montage(imgs, layout=None, fill=0, border=5):
    '''Tiles given images together in a single montage image.
       imgs is an iterable of (h, w) or (h, w, c) arrays.
    '''
    sz = imgs[0].shape
    assert all([sz == x.shape for x in imgs])
    if len(sz) == 3:
        (h, w, c) = sz
    elif len(sz) == 2:
        (h, w) = sz
        c = 1
    else:
        raise ValueError('images must be 2 or 3 dimensional')

    bw = bh = 0
    if border:
        try:
            (bh, bw) = border
        except TypeError:
            bh = bw = int(border)
    nimgs = len(imgs)

    if layout is None:
        (ncols, nrows) = (None, None)
    else:
        (nrows, ncols) = layout

    if not (nrows and nrows > 0) and not (ncols and ncols > 0):
        if w >= h:
            ncols = np.ceil(np.sqrt(nimgs * h / float(w)))
            nrows = np.ceil(nimgs / float(ncols))
        else:
            nrows = np.ceil(np.sqrt(nimgs * w / float(h)))
            ncols = np.ceil(nimgs / float(nrows))
    elif not (nrows and nrows > 0):
        nrows = np.ceil(nimgs / float(ncols))
    elif not (ncols and ncols > 0):
        ncols = np.ceil(nimgs / float(nrows))

    mw = w * ncols + bw * (ncols-1)
    mh = h * nrows + bh * (nrows-1)
    assert mh * mw >= w*h*nimgs, 'layout not big enough to for images'
    M = np.zeros((int(mh), int(mw), c))
    M += fill
    i = 0
    j = 0
    for img in imgs:
        M[i:i+h, j:j+w, :] = img.reshape((h, w, c))
        j += w + bw
        if j >= mw:
            i += h + bh
            j = 0
    if len(sz) == 1:
        M = M.reshape((mh, mw))
    return M


def images(images, **opts):
    # TODO: need to merge images into a single canvas
    montage = image_montage(images)
    return image(montage)


def plot(data, **opts):
    """ Plot data as line chart.
	Params:
		data: either a 2-d numpy array or a list of lists.
		win: pane id
		labels: list of series names, first series is always the X-axis
		see http://dygraphs.com/options.html for other supported options
	"""
    dataset = {}
    if type(data).__module__ == np.__name__:
        dataset = data.tolist()
    else:
        dataset = data

    # clone opts into options
    options = dict(opts)
    options['file'] = dataset
    if options.get('labels'):
        options['xlabel'] = options['labels'][0]

    # Don't pass our options to dygraphs.
    options.pop('win', None)

    return pane('plot', opts.get('win'), opts.get('title'), content=options)


def text(data, **opts):
    return pane('text', opts.get('win'), opts.get('title'), content=data)


def mesh(data, **opts):
    return pane('mesh', opts.get('win'), opts.get('title'), content=data)


def volume2isosurface(vol):
    return vol * -1


def volume(data, **opts):
    vol = volume2isosurface(data)
    pad = 1
    vol = np.pad(vol, pad_width=((pad, pad), (pad, pad), (pad, pad)), mode='constant', constant_values=0)
    isosurface(vol)


def isosurface(data, **opts):
    options = dict()
    options['file'] = data.tolist()
    options['size'] = data.shape[0]
    options['threshold'] = 0.0 if opts.get('threshold') is None else opts.get('threshold')
    print("Threshold:", options['threshold'])
    return pane('isosurface', opts.get('win'), opts.get('title'), content=options)


def graph3d(data, **opts):
    """ Plot data as 3D surface chart.
	Params:
		data: either a 2-d numpy array or a list of lists.
		win: pane id
		labels: list of series names, first series is always the X-axis
		see http://dygraphs.com/options.html for other supported options
	"""
    dataset = {}
    if type(data).__module__ == np.__name__:
        dataset = data.tolist()
    else:
        dataset = data

    # clone opts into options
    options = dict(opts)
    options['file'] = dataset
    if options.get('labels'):
        options['xlabel'] = options['labels'][0]

    # Don't pass our options to dygraphs.
    options.pop('win', None)

    return pane('graph3d', opts.get('win'), opts.get('title'), content=options)


def networkGraph(data, **opts):
    options = dict(opts)
    options['nodes'] = data[0]
    options['edges'] = data[1]

    return pane('network', opts.get('win'), opts.get('title'), content=options)
