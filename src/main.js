import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js'
import './style.css'

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
})

renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.xr.enabled = true

document.body.appendChild(renderer.domElement)

document.body.appendChild(
  ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
  })
)

const light = new THREE.HemisphereLight(0xffffff, 0x444444, 2)
scene.add(light)

const loader = new GLTFLoader()

const placedGroup = new THREE.Group()
placedGroup.position.set(0, 0, -1.5)
scene.add(placedGroup)

const BASE_PATH = '/q7Ibg5jhqdHRTcDokXP8'

const layers = [
  {
    id: '889_4',
    label: '第4層',
    path: `${BASE_PATH}/models/889_4.glb`,
    visible: false,
    object: null,
  },
  {
    id: '889_3',
    label: '第3層',
    path: `${BASE_PATH}/models/889_3.glb`,
    visible: false,
    object: null,
  },
  {
    id: '889_2',
    label: '第2層',
    path: `${BASE_PATH}/models/889_2.glb`,
    visible: false,
    object: null,
  },
  {
    id: '889_1',
    label: '第1層',
    path: `${BASE_PATH}/models/889_1.glb`,
    visible: true,
    object: null,
  },
]

const ui = document.createElement('div')
ui.className = 'layer-ui'
document.body.appendChild(ui)

layers.forEach((layer) => {
  const button = document.createElement('button')

  button.textContent = layer.label

  button.className = layer.visible
    ? 'layer-button active'
    : 'layer-button inactive'

  button.addEventListener('click', () => {
    layer.visible = !layer.visible

    if (layer.object) {
      layer.object.visible = layer.visible
    }

    button.className = layer.visible
      ? 'layer-button active'
      : 'layer-button inactive'
  })

  ui.appendChild(button)

  loader.load(
    layer.path,

    (gltf) => {
      const model = gltf.scene

      model.position.set(0, 0, 0)
      model.scale.set(1, 1, 1)
      model.visible = layer.visible

      layer.object = model

      placedGroup.add(model)

      console.log(`${layer.label} loaded`)
    },

    undefined,

    (error) => {
      console.error(`${layer.label} load error:`, error)
    }
  )
})

renderer.setAnimationLoop(() => {
  renderer.render(scene, camera)
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight

  camera.updateProjectionMatrix()

  renderer.setSize(window.innerWidth, window.innerHeight)
})
