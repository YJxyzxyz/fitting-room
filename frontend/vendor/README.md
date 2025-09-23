# Viewer vendor directory

This directory now ships with a self-contained, CDN-free viewer stack that the
front-end imports directly. The minimal implementation mirrors the pieces of
Three.js that the application requires (scene graph, WebGL renderer, orbit
controls, and a glTF loader tuned for the pipeline outputs) so that restricted
networks can still initialise the 3D preview.

The modules are organised as follows:

```
frontend/vendor/three/build/three.module.js
frontend/vendor/three/examples/jsm/controls/OrbitControls.js
frontend/vendor/three/examples/jsm/loaders/GLTFLoader.js
```

If you need to upgrade or replace the viewer runtime, regenerate the files above
from the desired implementation and keep the same relative paths so the static
imports in `frontend/app.js` continue to work.
