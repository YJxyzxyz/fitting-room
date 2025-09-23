// Minimal Three.js-compatible subset for the virtual try-on viewer.
// Provides enough functionality to render coloured meshes exported by the backend
// without relying on external CDNs. The API surface intentionally mirrors the
// pieces of three.js that the application uses (scenes, cameras, lights,
// geometry containers, a basic WebGL renderer, bounding boxes and vectors).

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  addVectors(a, b) {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    this.z = a.z + b.z;
    return this;
  }

  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  subVectors(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }

  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize() {
    const len = this.length();
    if (len > 0) {
      this.multiplyScalar(1 / len);
    }
    return this;
  }

  cross(v) {
    return this.crossVectors(this.clone(), v);
  }

  crossVectors(a, b) {
    const ax = a.x, ay = a.y, az = a.z;
    const bx = b.x, by = b.y, bz = b.z;
    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }

  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  distanceTo(v) {
    return Math.sqrt(this.distanceToSquared(v));
  }

  distanceToSquared(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }

  applyMatrix4(m) {
    const x = this.x;
    const y = this.y;
    const z = this.z;
    const e = m.elements;

    const w = e[3] * x + e[7] * y + e[11] * z + e[15] || 1.0;

    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) / w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) / w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) / w;
    return this;
  }

  setFromMatrixPosition(m) {
    const e = m.elements;
    this.x = e[12];
    this.y = e[13];
    this.z = e[14];
    return this;
  }
}

class Euler {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(e) {
    this.x = e.x;
    this.y = e.y;
    this.z = e.z;
    return this;
  }

  clone() {
    return new Euler(this.x, this.y, this.z);
  }
}

class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  set(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  copy(q) {
    this.x = q.x;
    this.y = q.y;
    this.z = q.z;
    this.w = q.w;
    return this;
  }

  clone() {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }

  setFromRotationMatrix(m) {
    const te = m.elements;
    const m11 = te[0], m12 = te[4], m13 = te[8];
    const m21 = te[1], m22 = te[5], m23 = te[9];
    const m31 = te[2], m32 = te[6], m33 = te[10];
    const trace = m11 + m22 + m33;

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      this.w = 0.25 / s;
      this.x = (m32 - m23) * s;
      this.y = (m13 - m31) * s;
      this.z = (m21 - m12) * s;
    } else if (m11 > m22 && m11 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
      this.w = (m32 - m23) / s;
      this.x = 0.25 * s;
      this.y = (m12 + m21) / s;
      this.z = (m13 + m31) / s;
    } else if (m22 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
      this.w = (m13 - m31) / s;
      this.x = (m12 + m21) / s;
      this.y = 0.25 * s;
      this.z = (m23 + m32) / s;
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
      this.w = (m21 - m12) / s;
      this.x = (m13 + m31) / s;
      this.y = (m23 + m32) / s;
      this.z = 0.25 * s;
    }

    return this;
  }
}

class Matrix4 {
  constructor() {
    this.elements = new Float32Array(16);
    this.identity();
  }

  set(
    n11, n12, n13, n14,
    n21, n22, n23, n24,
    n31, n32, n33, n34,
    n41, n42, n43, n44,
  ) {
    const te = this.elements;
    te[0] = n11; te[4] = n12; te[8] = n13; te[12] = n14;
    te[1] = n21; te[5] = n22; te[9] = n23; te[13] = n24;
    te[2] = n31; te[6] = n32; te[10] = n33; te[14] = n34;
    te[3] = n41; te[7] = n42; te[11] = n43; te[15] = n44;
    return this;
  }

  identity() {
    return this.set(
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    );
  }

  copy(m) {
    this.elements.set(m.elements);
    return this;
  }

  clone() {
    const m = new Matrix4();
    return m.copy(this);
  }

  multiply(m) {
    return this.multiplyMatrices(this, m);
  }

  premultiply(m) {
    return this.multiplyMatrices(m, this);
  }

  multiplyMatrices(a, b) {
    const ae = a.elements;
    const be = b.elements;
    const te = this.elements;

    const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];

    const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];

    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

    te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

    te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

    te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

    return this;
  }

  makePerspective(fov, aspect, near, far) {
    const top = near * Math.tan((fov * Math.PI) / 360);
    const height = 2 * top;
    const width = aspect * height;
    const left = -width / 2;
    const right = width / 2;
    const bottom = -top;

    const te = this.elements;
    const x = (2 * near) / (right - left);
    const y = (2 * near) / (top - bottom);

    const a = (right + left) / (right - left);
    const b = (top + bottom) / (top - bottom);
    const c = -(far + near) / (far - near);
    const d = (-2 * far * near) / (far - near);

    te[0] = x; te[4] = 0; te[8] = a; te[12] = 0;
    te[1] = 0; te[5] = y; te[9] = b; te[13] = 0;
    te[2] = 0; te[6] = 0; te[10] = c; te[14] = d;
    te[3] = 0; te[7] = 0; te[11] = -1; te[15] = 0;
    return this;
  }

  compose(position, quaternion, scale) {
    const te = this.elements;

    const x = quaternion.x, y = quaternion.y, z = quaternion.z, w = quaternion.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    const sx = scale.x, sy = scale.y, sz = scale.z;

    te[0] = (1 - (yy + zz)) * sx;
    te[1] = (xy + wz) * sx;
    te[2] = (xz - wy) * sx;
    te[3] = 0;

    te[4] = (xy - wz) * sy;
    te[5] = (1 - (xx + zz)) * sy;
    te[6] = (yz + wx) * sy;
    te[7] = 0;

    te[8] = (xz + wy) * sz;
    te[9] = (yz - wx) * sz;
    te[10] = (1 - (xx + yy)) * sz;
    te[11] = 0;

    te[12] = position.x;
    te[13] = position.y;
    te[14] = position.z;
    te[15] = 1;
    return this;
  }

  lookAt(eye, target, up) {
    const te = this.elements;

    const z = eye.clone().sub(target);
    if (z.length() === 0) {
      z.z = 1;
    }
    z.normalize();

    const x = up.clone().cross(z);
    if (x.length() === 0) {
      z.z += 1e-4;
      z.normalize();
      x.copy(up).cross(z);
    }
    x.normalize();

    const y = z.clone().cross(x);

    te[0] = x.x; te[4] = y.x; te[8] = z.x;
    te[1] = x.y; te[5] = y.y; te[9] = z.y;
    te[2] = x.z; te[6] = y.z; te[10] = z.z;

    te[3] = 0; te[7] = 0; te[11] = 0;
    te[12] = -(x.dot(eye));
    te[13] = -(y.dot(eye));
    te[14] = -(z.dot(eye));
    te[15] = 1;
    return this;
  }

  transpose() {
    const te = this.elements;
    let tmp;

    tmp = te[1]; te[1] = te[4]; te[4] = tmp;
    tmp = te[2]; te[2] = te[8]; te[8] = tmp;
    tmp = te[6]; te[6] = te[9]; te[9] = tmp;

    tmp = te[3]; te[3] = te[12]; te[12] = tmp;
    tmp = te[7]; te[7] = te[13]; te[13] = tmp;
    tmp = te[11]; te[11] = te[14]; te[14] = tmp;

    return this;
  }

  invert() {
    const te = this.elements;
    const n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3];
    const n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7];
    const n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11];
    const n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15];

    const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
    const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
    const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
    const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;

    const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;

    if (det === 0) {
      console.warn('Matrix4: .invert() can not invert matrix, determinant is 0');
      return this.identity();
    }

    const detInv = 1 / det;

    te[0] = t11 * detInv;
    te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv;
    te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv;
    te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv;

    te[4] = t12 * detInv;
    te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv;
    te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv;
    te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv;

    te[8] = t13 * detInv;
    te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv;
    te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv;
    te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv;

    te[12] = t14 * detInv;
    te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv;
    te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv;
    te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv;

    return this;
  }
}

class Color {
  constructor(value = 0xffffff) {
    this.r = 1;
    this.g = 1;
    this.b = 1;
    this.set(value);
  }

  set(value) {
    if (value instanceof Color) {
      this.copy(value);
      return this;
    }
    if (typeof value === 'number') {
      return this.setHex(value);
    }
    if (typeof value === 'string') {
      return this.setStyle(value);
    }
    return this;
  }

  setHex(hex) {
    const normalized = hex >>> 0;
    this.r = ((normalized >> 16) & 255) / 255;
    this.g = ((normalized >> 8) & 255) / 255;
    this.b = (normalized & 255) / 255;
    return this;
  }

  setStyle(style) {
    const str = style.trim();
    if (str.startsWith('#')) {
      const hex = str.slice(1);
      if (hex.length === 6) {
        const value = parseInt(hex, 16);
        this.r = ((value >> 16) & 255) / 255;
        this.g = ((value >> 8) & 255) / 255;
        this.b = (value & 255) / 255;
      } else if (hex.length === 8) {
        const value = parseInt(hex.slice(0, 6), 16);
        this.r = ((value >> 16) & 255) / 255;
        this.g = ((value >> 8) & 255) / 255;
        this.b = (value & 255) / 255;
      }
      return this;
    }
    if (str.startsWith('rgb')) {
      const parts = str.replace(/[rgba()]/g, '').split(',').map((v) => parseFloat(v.trim()));
      this.r = (parts[0] ?? 255) / 255;
      this.g = (parts[1] ?? 255) / 255;
      this.b = (parts[2] ?? 255) / 255;
      return this;
    }
    return this;
  }

  copy(color) {
    this.r = color.r;
    this.g = color.g;
    this.b = color.b;
    return this;
  }

  clone() {
    return new Color(this);
  }

  multiplyScalar(s) {
    this.r *= s;
    this.g *= s;
    this.b *= s;
    return this;
  }

  toArray(target = [], offset = 0) {
    target[offset] = this.r;
    target[offset + 1] = this.g;
    target[offset + 2] = this.b;
    return target;
  }
}

let _object3DId = 0;

class Object3D {
  constructor() {
    this.id = _object3DId += 1;
    this.type = 'Object3D';
    this.name = '';
    this.parent = null;
    this.children = [];
    this.position = new Vector3();
    this.quaternion = new Quaternion();
    this.scale = new Vector3(1, 1, 1);
    this.up = new Vector3(0, 1, 0);
    this.matrix = new Matrix4();
    this.matrixWorld = new Matrix4();
    this.matrixAutoUpdate = true;
    this.matrixWorldNeedsUpdate = true;
    this.visible = true;
  }

  add(...objects) {
    for (const object of objects) {
      if (object === this) continue;
      if (object.parent) {
        object.parent.remove(object);
      }
      object.parent = this;
      this.children.push(object);
    }
    return this;
  }

  remove(...objects) {
    for (const object of objects) {
      const index = this.children.indexOf(object);
      if (index !== -1) {
        object.parent = null;
        this.children.splice(index, 1);
      }
    }
    return this;
  }

  updateMatrix() {
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.matrixWorldNeedsUpdate = true;
  }

  updateMatrixWorld(force = false) {
    if (this.matrixAutoUpdate) {
      this.updateMatrix();
    }

    if (this.matrixWorldNeedsUpdate || force) {
      if (this.parent) {
        this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
      } else {
        this.matrixWorld.copy(this.matrix);
      }
      this.matrixWorldNeedsUpdate = false;
      force = true;
    }

    for (const child of this.children) {
      child.updateMatrixWorld(force);
    }
  }

  traverse(callback) {
    callback(this);
    for (const child of this.children) {
      child.traverse(callback);
    }
  }

  lookAt(x, y, z) {
    let target;
    if (x instanceof Vector3) {
      target = x;
    } else {
      target = new Vector3(x, y, z);
    }
    const m = new Matrix4().lookAt(this.position, target, this.up);
    this.quaternion.setFromRotationMatrix(m);
  }
}

class Group extends Object3D {
  constructor() {
    super();
    this.type = 'Group';
  }
}

class Scene extends Object3D {
  constructor() {
    super();
    this.type = 'Scene';
    this.background = null;
  }
}

class Camera extends Object3D {
  constructor() {
    super();
    this.type = 'Camera';
    this.matrixWorldInverse = new Matrix4();
    this.projectionMatrix = new Matrix4();
  }

  updateMatrixWorld(force) {
    super.updateMatrixWorld(force);
    this.matrixWorldInverse.copy(this.matrixWorld).invert();
  }
}

class PerspectiveCamera extends Camera {
  constructor(fov = 50, aspect = 1, near = 0.1, far = 2000) {
    super();
    this.type = 'PerspectiveCamera';
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.updateProjectionMatrix();
  }

  updateProjectionMatrix() {
    this.projectionMatrix.makePerspective(this.fov, this.aspect, this.near, this.far);
  }

  setLens(focalLength, frameHeight = 24) {
    const fov = (2 * Math.atan(frameHeight / (2 * focalLength))) * (180 / Math.PI);
    this.fov = fov;
    this.updateProjectionMatrix();
  }
}

class Light extends Object3D {
  constructor(color = 0xffffff, intensity = 1) {
    super();
    this.type = 'Light';
    this.color = new Color(color);
    this.intensity = intensity;
  }
}

class AmbientLight extends Light {
  constructor(color = 0xffffff, intensity = 1) {
    super(color, intensity);
    this.type = 'AmbientLight';
  }
}

class DirectionalLight extends Light {
  constructor(color = 0xffffff, intensity = 1) {
    super(color, intensity);
    this.type = 'DirectionalLight';
    this.target = new Object3D();
  }
}

class BufferAttribute {
  constructor(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.count = array.length / itemSize;
  }
}

class BufferGeometry {
  constructor() {
    this.type = 'BufferGeometry';
    this.attributes = {};
    this.index = null;
    this.boundingBox = null;
  }

  setAttribute(name, attribute) {
    this.attributes[name] = attribute;
    return this;
  }

  setIndex(attribute) {
    this.index = attribute;
    return this;
  }

  computeBoundingBox() {
    const position = this.attributes.position;
    const box = new Box3();
    if (!position) {
      box.makeEmpty();
      this.boundingBox = box;
      return;
    }
    box.makeEmpty();
    const array = position.array;
    const point = new Vector3();
    for (let i = 0; i < array.length; i += position.itemSize) {
      point.set(array[i], array[i + 1], array[i + 2]);
      box.expandByPoint(point);
    }
    this.boundingBox = box;
  }
}

class Material {
  constructor(parameters = {}) {
    this.visible = true;
    Object.assign(this, parameters);
  }
}

class MeshBasicMaterial extends Material {
  constructor(parameters = {}) {
    super(parameters);
    this.type = 'MeshBasicMaterial';
    this.vertexColors = parameters.vertexColors ?? true;
  }
}

class Mesh extends Object3D {
  constructor(geometry = new BufferGeometry(), material = new MeshBasicMaterial()) {
    super();
    this.type = 'Mesh';
    this.geometry = geometry;
    this.material = material;
  }
}

class Box3 {
  constructor(min = new Vector3(+Infinity, +Infinity, +Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity)) {
    this.min = min;
    this.max = max;
  }

  makeEmpty() {
    this.min.set(+Infinity, +Infinity, +Infinity);
    this.max.set(-Infinity, -Infinity, -Infinity);
    return this;
  }

  isEmpty() {
    return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z;
  }

  expandByPoint(point) {
    this.min.x = Math.min(this.min.x, point.x);
    this.min.y = Math.min(this.min.y, point.y);
    this.min.z = Math.min(this.min.z, point.z);

    this.max.x = Math.max(this.max.x, point.x);
    this.max.y = Math.max(this.max.y, point.y);
    this.max.z = Math.max(this.max.z, point.z);
    return this;
  }

  setFromObject(object) {
    this.makeEmpty();
    const point = new Vector3();
    object.traverse((node) => {
      if (!node.visible) return;
      if (!(node instanceof Mesh)) return;
      const geometry = node.geometry;
      const position = geometry.attributes.position;
      if (!position) return;
      const array = position.array;
      for (let i = 0; i < array.length; i += position.itemSize) {
        point.set(array[i], array[i + 1], array[i + 2]).applyMatrix4(node.matrixWorld);
        this.expandByPoint(point);
      }
    });
    if (this.isEmpty()) {
      this.min.set(0, 0, 0);
      this.max.set(0, 0, 0);
    }
    return this;
  }

  getSize(target = new Vector3()) {
    target.subVectors(this.max, this.min);
    return target;
  }

  getCenter(target = new Vector3()) {
    return target.addVectors(this.min, this.max).multiplyScalar(0.5);
  }
}

function createNormalMatrix(modelMatrix) {
  const m = new Matrix4().copy(modelMatrix).invert().transpose();
  const e = m.elements;
  return new Float32Array([
    e[0], e[1], e[2],
    e[4], e[5], e[6],
    e[8], e[9], e[10],
  ]);
}

const tempMatrix = new Matrix4();

class WebGLRenderer {
  constructor(parameters = {}) {
    const { canvas, antialias = true } = parameters;
    this.domElement = canvas || document.createElement('canvas');
    this._pixelRatio = 1;
    this._width = this.domElement.width;
    this._height = this.domElement.height;
    this._program = null;
    this._buffers = new WeakMap();

    const contextAttributes = { antialias };
    const gl = this.domElement.getContext('webgl2', contextAttributes)
      || this.domElement.getContext('webgl', contextAttributes)
      || this.domElement.getContext('experimental-webgl', contextAttributes);

    if (!gl) {
      throw new Error('WebGLRenderer: WebGL not supported.');
    }

    this.gl = gl;
    this._hasElementIndexUint = gl.getExtension('OES_element_index_uint');
    this._initProgram();
  }

  setPixelRatio(ratio) {
    this._pixelRatio = ratio || 1;
  }

  setSize(width, height, updateStyle = true) {
    this._width = width;
    this._height = height;
    const canvas = this.domElement;
    canvas.width = width * this._pixelRatio;
    canvas.height = height * this._pixelRatio;
    if (updateStyle) {
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
  }

  _initProgram() {
    const gl = this.gl;
    const vertexShaderSource = `#version 100\n\
attribute vec3 position;\n\
attribute vec3 normal;\n\
attribute vec4 color;\n\
uniform mat4 modelMatrix;\n\
uniform mat4 viewMatrix;\n\
uniform mat4 projectionMatrix;\n\
uniform mat3 normalMatrix;\n\
uniform vec3 ambientColor;\n\
uniform vec3 directionalColor;\n\
uniform vec3 directionalDirection;\n\
varying vec4 vColor;\n\
varying float vLight;\n\
void main() {\n\
  vec3 transformedNormal = normalize(normalMatrix * normal);\n\
  vLight = max(dot(transformedNormal, -directionalDirection), 0.0);\n\
  vColor = color;\n\
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);\n\
}`;

    const fragmentShaderSource = `#version 100\n\
precision mediump float;\n\
uniform vec3 ambientColor;\n\
uniform vec3 directionalColor;\n\
varying vec4 vColor;\n\
varying float vLight;\n\
void main() {\n\
  vec3 lighting = ambientColor + directionalColor * vLight;\n\
  vec3 base = vColor.rgb * lighting;\n\
  gl_FragColor = vec4(base, vColor.a);\n\
}`;

    const vertexShader = this._compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`WebGL program failed to link: ${info}`);
    }

    this._program = program;
    gl.useProgram(program);

    this._attributes = {
      position: gl.getAttribLocation(program, 'position'),
      normal: gl.getAttribLocation(program, 'normal'),
      color: gl.getAttribLocation(program, 'color'),
    };

    this._uniforms = {
      modelMatrix: gl.getUniformLocation(program, 'modelMatrix'),
      viewMatrix: gl.getUniformLocation(program, 'viewMatrix'),
      projectionMatrix: gl.getUniformLocation(program, 'projectionMatrix'),
      normalMatrix: gl.getUniformLocation(program, 'normalMatrix'),
      ambientColor: gl.getUniformLocation(program, 'ambientColor'),
      directionalColor: gl.getUniformLocation(program, 'directionalColor'),
      directionalDirection: gl.getUniformLocation(program, 'directionalDirection'),
    };

    gl.enableVertexAttribArray(this._attributes.position);
    gl.enableVertexAttribArray(this._attributes.normal);
    gl.enableVertexAttribArray(this._attributes.color);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Failed to compile shader: ${info}`);
    }
    return shader;
  }

  _getGeometryBuffers(geometry) {
    if (this._buffers.has(geometry)) {
      return this._buffers.get(geometry);
    }
    const gl = this.gl;
    const buffers = {};

    const attributes = geometry.attributes;
    const createBuffer = (attribute, target, type) => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(target, buffer);
      gl.bufferData(target, attribute.array, gl.STATIC_DRAW);
      return buffer;
    };

    if (attributes.position) {
      buffers.position = createBuffer(attributes.position, gl.ARRAY_BUFFER);
    }
    if (attributes.normal) {
      buffers.normal = createBuffer(attributes.normal, gl.ARRAY_BUFFER);
    }
    if (attributes.color) {
      buffers.color = createBuffer(attributes.color, gl.ARRAY_BUFFER);
    }
    if (geometry.index) {
      buffers.index = createBuffer(geometry.index, gl.ELEMENT_ARRAY_BUFFER);
    }

    this._buffers.set(geometry, buffers);
    return buffers;
  }

  render(scene, camera) {
    const gl = this.gl;
    const canvas = this.domElement;

    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    const background = scene.background instanceof Color ? scene.background : new Color('#0f172a');
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(background.r, background.g, background.b, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const ambient = new Color(0x000000);
    const directional = { color: new Color(0x000000), direction: new Vector3(0, 1, 0) };

    scene.traverse((object) => {
      if (object instanceof AmbientLight) {
        const intensityColor = object.color.clone().multiplyScalar(object.intensity);
        ambient.r += intensityColor.r;
        ambient.g += intensityColor.g;
        ambient.b += intensityColor.b;
      }
      if (object instanceof DirectionalLight) {
        const intensityColor = object.color.clone().multiplyScalar(object.intensity);
        directional.color.r += intensityColor.r;
        directional.color.g += intensityColor.g;
        directional.color.b += intensityColor.b;
        const target = object.target || new Object3D();
        const dir = target.position.clone().sub(object.position).normalize();
        directional.direction = dir;
      }
    });

    const program = this._program;
    gl.useProgram(program);
    gl.uniformMatrix4fv(this._uniforms.viewMatrix, false, camera.matrixWorldInverse.elements);
    gl.uniformMatrix4fv(this._uniforms.projectionMatrix, false, camera.projectionMatrix.elements);
    gl.uniform3f(this._uniforms.ambientColor, ambient.r, ambient.g, ambient.b);
    gl.uniform3f(
      this._uniforms.directionalColor,
      directional.color.r,
      directional.color.g,
      directional.color.b,
    );
    gl.uniform3f(
      this._uniforms.directionalDirection,
      directional.direction.x,
      directional.direction.y,
      directional.direction.z,
    );

    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (!object.visible) return;

      const geometry = object.geometry;
      const buffers = this._getGeometryBuffers(geometry);

      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
      gl.vertexAttribPointer(this._attributes.position, 3, gl.FLOAT, false, 0, 0);

      if (buffers.normal && geometry.attributes.normal) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
        gl.vertexAttribPointer(this._attributes.normal, 3, gl.FLOAT, false, 0, 0);
      }

      if (buffers.color && geometry.attributes.color) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
        gl.vertexAttribPointer(this._attributes.color, 4, gl.FLOAT, false, 0, 0);
      }

      gl.uniformMatrix4fv(this._uniforms.modelMatrix, false, object.matrixWorld.elements);
      const normalMatrix = createNormalMatrix(object.matrixWorld);
      gl.uniformMatrix3fv(this._uniforms.normalMatrix, false, normalMatrix);

      if (buffers.index && geometry.index) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);
        const array = geometry.index.array;
        let type = gl.UNSIGNED_SHORT;
        if (array instanceof Uint32Array) {
          if (!this._hasElementIndexUint) {
            throw new Error('WebGLRenderer: Uint32 indices require OES_element_index_uint support.');
          }
          type = gl.UNSIGNED_INT;
        } else if (array instanceof Uint16Array) {
          type = gl.UNSIGNED_SHORT;
        } else if (array instanceof Uint8Array) {
          type = gl.UNSIGNED_BYTE;
        }
        gl.drawElements(gl.TRIANGLES, geometry.index.count, type, 0);
      } else {
        const position = geometry.attributes.position;
        gl.drawArrays(gl.TRIANGLES, 0, position.count);
      }
    });
  }
}

export {
  AmbientLight,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Camera,
  Color,
  DirectionalLight,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
};
