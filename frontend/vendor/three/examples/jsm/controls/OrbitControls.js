import { Vector3 } from '../../build/three.module.js';

const STATE = {
  NONE: 0,
  ROTATE: 1,
};

export class OrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement || camera?.domElement || document;

    this.enabled = true;
    this.target = new Vector3();
    this.enableDamping = false;
    this.dampingFactor = 0.1;
    this.rotateSpeed = 1.0;
    this.zoomSpeed = 1.0;
    this.minDistance = 0.5;
    this.maxDistance = 50;
    this.minPolarAngle = 0.01;
    this.maxPolarAngle = Math.PI - 0.01;

    this._state = STATE.NONE;
    this._pointer = { x: 0, y: 0 };
    this._deltaTheta = 0;
    this._deltaPhi = 0;
    this._deltaRadius = 0;

    this._spherical = { radius: 1, theta: 0, phi: Math.PI / 2 };
    this._updateSpherical();

    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onWheel = this._handleWheel.bind(this);

    this.domElement.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointermove', this._onPointerMove);
    this.domElement.addEventListener('wheel', this._onWheel, { passive: false });
  }

  dispose() {
    this.domElement.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointermove', this._onPointerMove);
    this.domElement.removeEventListener('wheel', this._onWheel);
  }

  _updateSpherical() {
    const offset = this.camera.position.clone().sub(this.target);
    const radius = Math.max(offset.length(), this.minDistance);
    this._spherical.radius = radius;
    this._spherical.theta = Math.atan2(offset.x, offset.z);
    this._spherical.phi = Math.acos(Math.min(Math.max(offset.y / radius, -1), 1));
  }

  _handlePointerDown(event) {
    if (!this.enabled) return;
    if (event.button !== 0) return;
    this.domElement.setPointerCapture?.(event.pointerId);
    this._state = STATE.ROTATE;
    this._pointer.x = event.clientX;
    this._pointer.y = event.clientY;
  }

  _handlePointerMove(event) {
    if (!this.enabled || this._state !== STATE.ROTATE) return;
    event.preventDefault();
    const dx = event.clientX - this._pointer.x;
    const dy = event.clientY - this._pointer.y;
    this._pointer.x = event.clientX;
    this._pointer.y = event.clientY;

    const element = this.domElement === document ? document.body : this.domElement;
    const width = element.clientWidth || window.innerWidth;
    const height = element.clientHeight || window.innerHeight;

    this._deltaTheta -= (2 * Math.PI * dx / width) * this.rotateSpeed;
    this._deltaPhi -= (2 * Math.PI * dy / height) * this.rotateSpeed;
  }

  _handlePointerUp(event) {
    if (!this.enabled) return;
    if (this._state === STATE.ROTATE) {
      this.domElement.releasePointerCapture?.(event.pointerId);
    }
    this._state = STATE.NONE;
  }

  _handleWheel(event) {
    if (!this.enabled) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? 1 : -1;
    this._deltaRadius += this._spherical.radius * 0.1 * delta * this.zoomSpeed;
  }

  update() {
    if (!this.enabled) return;

    this._spherical.theta += this._deltaTheta;
    this._spherical.phi += this._deltaPhi;
    this._spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this._spherical.phi));

    this._spherical.radius += this._deltaRadius;
    this._spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this._spherical.radius));

    const sinPhiRadius = Math.sin(this._spherical.phi) * this._spherical.radius;
    const x = sinPhiRadius * Math.sin(this._spherical.theta);
    const y = Math.cos(this._spherical.phi) * this._spherical.radius;
    const z = sinPhiRadius * Math.cos(this._spherical.theta);

    this.camera.position.set(x, y, z).add(this.target);
    this.camera.lookAt(this.target);

    if (this.enableDamping) {
      this._deltaTheta *= 1 - this.dampingFactor;
      this._deltaPhi *= 1 - this.dampingFactor;
      this._deltaRadius *= 1 - this.dampingFactor;
    } else {
      this._deltaTheta = 0;
      this._deltaPhi = 0;
      this._deltaRadius = 0;
    }
  }
}
