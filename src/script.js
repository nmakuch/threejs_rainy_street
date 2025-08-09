import * as THREE from 'three'

import Stats from 'three/examples/jsm/libs/stats.module.js'
import GUI from 'lil-gui'
import { OrbitControls } from 'three/examples/jsm/Addons.js'

import { GLTFLoader, RGBELoader, DRACOLoader } from 'three/examples/jsm/Addons.js'
import CustomShaderMaterial from 'three-custom-shader-material/vanilla'
import { TextureLoader } from 'three'
import { patchShaders } from 'gl-noise'

import _puddleVertexShader from './shaders/puddle/vertex.glsl'
import _puddleFragmentShader from './shaders/puddle/fragment.glsl'

import rainDropsVertexShader from './shaders/rain/vertex.glsl'
import rainDropsFragmentShader from './shaders/rain/fragment.glsl'

const puddleVertexShader = await patchShaders(_puddleVertexShader)
const puddleFragmentShader = await patchShaders(_puddleFragmentShader)

// Camera dimensions
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

let canvas, stats
let camera, scene, renderer, controls

let sun

// Loaders
const rgbeLoader = new RGBELoader().setPath('/textures/equirectangular/')
const gltfLoader = new GLTFLoader().setPath('/models/gltf/')
const textureLoader = new TextureLoader()

gltfLoader.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/gltf/'))

init()

// Initialize scene
async function init() {
    // Canvas
    canvas = document.createElement('div')
    document.body.appendChild(canvas)

    // Scene
    scene = new THREE.Scene()

    // Camera
    camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 1000)
    camera.position.set(0.5, 0.5, 1)
    camera.lookAt(0, 0, 0)
    scene.add(camera)

    // Sun
    sun = new THREE.DirectionalLight(0xFFFFFF, 1.0)
    sun.position.set(-1, 2.6, 1.4)
    scene.add(sun)

    // Renderer
    renderer = new THREE.WebGLRenderer()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(sizes.width, sizes.height)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.75
    canvas.appendChild(renderer.domElement)

    // Controls
    controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true

    // Stats
    stats = new Stats()
    canvas.appendChild(stats.dom)

    // Event Listeners
    window.addEventListener('resize', onWindowResize)

    // Environment Mapping
    const [environment] = await Promise.all([rgbeLoader.loadAsync('./vignaioli_night_1k.hdr')/* gltfLoader.loadAsync('duck.glb') */])
    environment.mapping = THREE.EquirectangularReflectionMapping
    scene.environment = environment
    scene.background = environment
    scene.backgroundIntensity = 1.0
    scene.backgroundBlurriness = 0.3
    scene.environmentIntensity = 1.5

    // GUI
    const gui = new GUI();

    renderer.setAnimationLoop(animate)
}
// END OF INIT

/**
 * Rain Drops
 */
const count = 30;
const _dummy = new THREE.Object3D()
const initialY = new Float32Array(count).fill(0)

const rainDropsMaterial = new CustomShaderMaterial({
    baseMaterial: new THREE.MeshBasicMaterial(),
    vertexShader: rainDropsVertexShader,
    fragmentShader: rainDropsFragmentShader,
    uniforms: {
        uTime: new THREE.Uniform(0)
    },
    transparent: true,
})

const rainDropsGeometry = new THREE.PlaneGeometry(0.07, 0.1)

const rainDrops = new THREE.InstancedMesh(rainDropsGeometry, rainDropsMaterial, count)

for (let i = 0; i < count; i++) {
    _dummy.position.set(
        THREE.MathUtils.randFloatSpread(5),
        THREE.MathUtils.randFloat(-0.1, 5),
        THREE.MathUtils.randFloatSpread(5)
    );

    _dummy.updateMatrix();
    rainDrops.setMatrixAt(i, _dummy.matrix);
}

rainDrops.instanceMatrix.needsUpdate = true;

scene.add(rainDrops)


/**
 * Puddle and Road
 */

// Textures
const puddleColorTexture = textureLoader.load('./road/aerial_asphalt_01_diff_2k.jpg')
puddleColorTexture.wrapS = THREE.RepeatWrapping
puddleColorTexture.wrapT = THREE.RepeatWrapping
puddleColorTexture.colorSpace = THREE.SRGBColorSpace

const puddleAoTexture = textureLoader.load('./road/aerial_asphalt_01_ao_2k.jpg')
puddleAoTexture.wrapS = THREE.RepeatWrapping
puddleAoTexture.wrapT = THREE.RepeatWrapping

const puddleNormalTexture = textureLoader.load('./road/aerial_asphalt_01_nor_gl_2k.jpg')
puddleNormalTexture.wrapS = THREE.RepeatWrapping
puddleNormalTexture.wrapT = THREE.RepeatWrapping

const puddleRoughnessTexture = textureLoader.load('./road/aerial_asphalt_01_rough_2k.jpg')
puddleRoughnessTexture.wrapS = THREE.RepeatWrapping
puddleRoughnessTexture.wrapT = THREE.RepeatWrapping

// Geometry
const planeGeometry = new THREE.PlaneGeometry(1, 1)
planeGeometry.rotateX(-Math.PI * 0.5)

// Material
const puddleMaterial = new CustomShaderMaterial({
    transparent: true,
    baseMaterial: new THREE.MeshPhysicalMaterial(),
    vertexShader: puddleVertexShader,
    fragmentShader: puddleFragmentShader,
    map: puddleColorTexture,
    aoMap: puddleAoTexture,
    normalMap: puddleNormalTexture,
    roughnessMap: puddleRoughnessTexture,
    uniforms: {
        uTime: new THREE.Uniform(0),
    },
    patchMap: {
        "*": {
            "#include <normal_fragment_maps>": `
                #include <normal_fragment_maps>
                normal = mix(normal, csm_PuddleNormal, csm_PuddleNormalMask);
            `
        }
    }
})

// Create mesh and add to scene
const plane = new THREE.Mesh(planeGeometry, puddleMaterial)
scene.add(plane)

/**
 * Event Handlers
 */
function onWindowResize() {
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
}

const clock = new THREE.Clock();

// Animation Loop
function animate() {
    // Render
    render()
    // Update stats
    stats.update()
}

function render() {
    // Elapsed Time
    const elapsedTime = clock.getElapsedTime();

    // Animate Rain Drops
    for (let i = 0; i < count; i++) {
        rainDrops.getMatrixAt(i, _dummy.matrix);
        _dummy.matrix.decompose(
            _dummy.position,
            _dummy.quaternion,
            _dummy.scale
        );

        _dummy.position.y -= 0.05;
        if (_dummy.position.y <= 0) {
            _dummy.position.set(
                THREE.MathUtils.randFloatSpread(1),
                THREE.MathUtils.randFloat(-0.1, 2),
                THREE.MathUtils.randFloatSpread(1)
            );
            initialY[i] = _dummy.position.y;
            _dummy.scale.setScalar(THREE.MathUtils.randFloat(0.1, 0.5));
        }

        _dummy.rotation.y = Math.atan2(
            camera.position.x - _dummy.position.x,
            camera.position.z - _dummy.position.z
        );

        _dummy.updateMatrix();
        rainDrops.setMatrixAt(i, _dummy.matrix);
    }
    rainDrops.instanceMatrix.needsUpdate = true;

    // Update uniforms
    puddleMaterial.uniforms.uTime.value = elapsedTime

    // Update controls
    controls.update()

    // Renderer
    renderer.render(scene, camera)
}