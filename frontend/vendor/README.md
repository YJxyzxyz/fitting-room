# Viewer vendor directory

The front-end will try to load the Three.js viewer stack from the CDN first.
If the CDN is unavailable (for example on restricted networks), place the
required modules in the paths below so that the local fallback can be used
instead:

```
frontend/vendor/three/build/three.module.js
frontend/vendor/three/examples/jsm/controls/OrbitControls.js
frontend/vendor/three/examples/jsm/loaders/GLTFLoader.js
```

The files should be copied from the matching Three.js release used by the
application (currently `three@0.160.0`). They will be detected automatically—no
code changes are needed after the files are present.
