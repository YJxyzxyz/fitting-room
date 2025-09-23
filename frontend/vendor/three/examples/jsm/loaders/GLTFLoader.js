import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from '../../build/three.module.js';

const COMPONENT_TYPE_ARRAY = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};

const TYPE_SIZES = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT3: 9,
  MAT4: 16,
};

function decodeDataUri(uri) {
  const match = uri.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    throw new Error(`Unsupported buffer URI: ${uri}`);
  }
  const base64 = match[2];
  let binaryString;
  if (typeof atob === 'function') {
    binaryString = atob(base64);
  } else if (typeof Buffer !== 'undefined') {
    binaryString = Buffer.from(base64, 'base64').toString('binary');
  } else {
    throw new Error('Base64 decoding not supported in this environment.');
  }
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function decomposeMatrix(matrixArray) {
  const m = new Matrix4();
  m.elements.set(matrixArray);
  const e = m.elements;
  const sx = new Vector3(e[0], e[1], e[2]).length();
  const sy = new Vector3(e[4], e[5], e[6]).length();
  const sz = new Vector3(e[8], e[9], e[10]).length();

  const position = new Vector3(e[12], e[13], e[14]);
  const scale = new Vector3(sx, sy, sz);

  const rotationMatrix = new Matrix4().set(
    e[0] / sx, e[4] / sy, e[8] / sz, 0,
    e[1] / sx, e[5] / sy, e[9] / sz, 0,
    e[2] / sx, e[6] / sy, e[10] / sz, 0,
    0, 0, 0, 1,
  );

  return { position, scale, rotationMatrix };
}

export class GLTFLoader {
  constructor(manager) {
    this.manager = manager;
  }

  load(url, onLoad, onProgress, onError) {
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load glTF: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
      .then(async (json) => {
        try {
          const baseUrl = url.replace(/[^/]*$/, '');
          const buffers = await this._loadBuffers(json, baseUrl);
          const scene = this._buildScene(json, buffers);
          if (onLoad) {
            onLoad({ scene });
          }
        } catch (error) {
          if (onError) onError(error);
          else console.error(error);
        }
      })
      .catch((error) => {
        if (onError) onError(error);
        else console.error(error);
      });
  }

  async _loadBuffers(json, baseUrl) {
    const buffers = [];
    for (const bufferDef of json.buffers || []) {
      if (bufferDef.uri?.startsWith('data:')) {
        buffers.push(decodeDataUri(bufferDef.uri));
      } else if (bufferDef.uri) {
        const bufferUrl = new URL(bufferDef.uri, baseUrl).href;
        const response = await fetch(bufferUrl);
        if (!response.ok) {
          throw new Error(`Failed to load buffer: ${bufferDef.uri}`);
        }
        buffers.push(await response.arrayBuffer());
      } else {
        buffers.push(new ArrayBuffer(bufferDef.byteLength || 0));
      }
    }
    return buffers;
  }

  _getAccessorData(json, buffers, accessorIndex) {
    const accessor = json.accessors?.[accessorIndex];
    if (!accessor) {
      throw new Error(`Missing accessor ${accessorIndex}`);
    }
    const bufferView = json.bufferViews?.[accessor.bufferView];
    const buffer = buffers[bufferView.buffer];
    const Component = COMPONENT_TYPE_ARRAY[accessor.componentType];
    if (!Component) {
      throw new Error(`Unsupported component type ${accessor.componentType}`);
    }
    const itemSize = TYPE_SIZES[accessor.type];
    const count = accessor.count;
    const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
    const byteStride = bufferView.byteStride || 0;

    if (!byteStride || byteStride === itemSize * Component.BYTES_PER_ELEMENT) {
      return new Component(buffer, byteOffset, itemSize * count);
    }

    const array = new Component(itemSize * count);
    const view = new DataView(buffer, byteOffset, byteStride * count);
    const littleEndian = true;
    for (let i = 0; i < count; i += 1) {
      for (let j = 0; j < itemSize; j += 1) {
        const elementOffset = i * byteStride + j * Component.BYTES_PER_ELEMENT;
        let value;
        switch (Component) {
          case Int8Array:
            value = view.getInt8(elementOffset);
            break;
          case Uint8Array:
            value = view.getUint8(elementOffset);
            break;
          case Int16Array:
            value = view.getInt16(elementOffset, littleEndian);
            break;
          case Uint16Array:
            value = view.getUint16(elementOffset, littleEndian);
            break;
          case Uint32Array:
            value = view.getUint32(elementOffset, littleEndian);
            break;
          default:
            value = view.getFloat32(elementOffset, littleEndian);
        }
        array[i * itemSize + j] = value;
      }
    }
    return array;
  }

  _buildScene(json, buffers) {
    const scene = new Group();
    const sceneIndex = json.scene ?? 0;
    const sceneDef = json.scenes?.[sceneIndex];
    if (!sceneDef) {
      return scene;
    }

    const buildNode = (nodeIndex) => {
      const nodeDef = json.nodes?.[nodeIndex];
      if (!nodeDef) {
        return null;
      }

      let object;
      if (typeof nodeDef.mesh === 'number') {
        object = this._buildMesh(json, buffers, nodeDef.mesh);
      } else {
        object = new Group();
      }

      if (nodeDef.name) {
        object.name = nodeDef.name;
      }

      if (nodeDef.matrix) {
        const { position, scale, rotationMatrix } = decomposeMatrix(nodeDef.matrix);
        object.position.copy(position);
        object.scale.copy(scale);
        object.quaternion.setFromRotationMatrix(rotationMatrix);
      } else {
        if (nodeDef.translation) {
          object.position.set(nodeDef.translation[0], nodeDef.translation[1], nodeDef.translation[2]);
        }
        if (nodeDef.rotation) {
          object.quaternion.set(nodeDef.rotation[0], nodeDef.rotation[1], nodeDef.rotation[2], nodeDef.rotation[3]);
        }
        if (nodeDef.scale) {
          object.scale.set(nodeDef.scale[0], nodeDef.scale[1], nodeDef.scale[2]);
        }
      }

      if (nodeDef.children) {
        for (const childIndex of nodeDef.children) {
          const child = buildNode(childIndex);
          if (child) {
            object.add(child);
          }
        }
      }

      return object;
    };

    for (const nodeIndex of sceneDef.nodes || []) {
      const node = buildNode(nodeIndex);
      if (node) {
        scene.add(node);
      }
    }

    return scene.children.length === 1 ? scene.children[0] : scene;
  }

  _buildMesh(json, buffers, meshIndex) {
    const meshDef = json.meshes?.[meshIndex];
    if (!meshDef) {
      throw new Error(`Missing mesh ${meshIndex}`);
    }

    const root = new Group();

    for (const primitive of meshDef.primitives || []) {
      const geometry = new BufferGeometry();
      const attributes = primitive.attributes || {};

      if (attributes.POSITION !== undefined) {
        const array = this._getAccessorData(json, buffers, attributes.POSITION);
        geometry.setAttribute('position', new BufferAttribute(array, TYPE_SIZES.VEC3));
      }
      if (attributes.NORMAL !== undefined) {
        const array = this._getAccessorData(json, buffers, attributes.NORMAL);
        geometry.setAttribute('normal', new BufferAttribute(array, TYPE_SIZES.VEC3));
      }
      if (attributes.COLOR_0 !== undefined) {
        const array = this._getAccessorData(json, buffers, attributes.COLOR_0);
        geometry.setAttribute('color', new BufferAttribute(array, TYPE_SIZES.VEC4));
      }
      if (primitive.indices !== undefined) {
        const array = this._getAccessorData(json, buffers, primitive.indices);
        geometry.setIndex(new BufferAttribute(array, 1));
      }

      geometry.computeBoundingBox();
      const mesh = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true }));
      root.add(mesh);
    }

    return root.children.length === 1 ? root.children[0] : root;
  }
}
