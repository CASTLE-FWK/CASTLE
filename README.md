# CASTLE
The CASTLE Distribution

## Dependencies
- Repast Simphony
- MongoDB (optional)
- XText (can be resolved automatically by Eclipse)

Other dependencies are baked into the JAR.

## How to install
1. Download Repast Simphony 2.4.0 [repast.github.io](https://repast.github.io/)
2. Add http://download.eclipse.org/modeling/tmf/xtext/updates/composite/releases/ to Available Software Sites in Repast
3. Update Repast (current CASL and CASTLE requires Eclipse Neon.3)
4. Download both CASL.zip (the CASL plugin) and CASTLE.jar (the CASTLE framework library)
5. In Eclipse: Help -> Install New Software -> Add... -> Archive...
	Point to CASL.zip. Install, wait for dependencies to resolve. Restart
6. In your project: Build Path -> Add External JARs -> Select CASTLE.jar

## Getting Started
1. There are template files for both [CASL](https://raw.githubusercontent.com/CASTLE-FWK/Models/master/TemplateModels/CASL-Template.casl) and [CASL-SG](https://raw.githubusercontent.com/CASTLE-FWK/Models/master/TemplateModels/CASL-SG-Template.casl) style models. Until CASL can create these with a new project, you'll have to copy paste.
2. Make sure you download `commons.casl` as well and keep it in each of your CASL projects (this is temporary)
3. Documentation is located at [ReadTheDocs](https://docs.castle-framework.io/en/latest/)
