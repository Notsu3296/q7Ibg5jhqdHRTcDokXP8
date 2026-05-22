// =====================
// maibun_ar main.js
// 画面観察モード用の基本ビューア
// PC / スマホ / タブレット操作対応版
// =====================

import './style.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// =====================
// HTML要素取得
// =====================

const app = document.querySelector('#app')
let isARMode = false

// =====================
// Three.js 基本設定
// =====================

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x202020)

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
)
camera.position.set(0, 0, 5)

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
})

renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
app.appendChild(renderer.domElement)

// =====================
// ARモード用：カメラ背景
// =====================

const cameraVideo = document.createElement('video')
cameraVideo.className = 'camera-video'
cameraVideo.autoplay = true
cameraVideo.playsInline = true
cameraVideo.muted = true
app.appendChild(cameraVideo)

const arStartButton = document.createElement('button')
arStartButton.className = 'ar-start-button'
arStartButton.textContent = 'AR START'
app.appendChild(arStartButton)

async function startARMode() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
      },
      audio: false,
    })

    cameraVideo.srcObject = stream
    cameraVideo.style.display = 'block'
    document.body.classList.add('ar-mode')
    arStartButton.style.display = 'none'
    isARMode = true

    scene.background = null
    renderer.setClearColor(0x000000, 0)
    await enableGyro()
  } catch (error) {
    console.error('カメラ起動に失敗:', error)
    alert('カメラを起動できませんでした')
  }
}

// =====================
// ジャイロ許可・取得
// =====================

async function enableGyro() {
  try {
    // iPhone / iPad Safari 用
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      const permission = await DeviceOrientationEvent.requestPermission()

      if (permission !== 'granted') {
        console.warn('ジャイロ許可が拒否されました')
        return
      }
    }

    window.addEventListener('deviceorientation', handleDeviceOrientation)
    gyroEnabled = true

    console.log('ジャイロ有効')
  } catch (error) {
    console.error('ジャイロ有効化に失敗:', error)
  }
}

function handleDeviceOrientation(event) {
  if (!gyroEnabled) return

  // beta: 前後の傾き
  // gamma: 左右の傾き
  gyroBeta = event.beta || 0
  gyroGamma = event.gamma || 0

  // 最初に取得した角度を基準にする
  if (gyroBaseBeta === null) {
    gyroBaseBeta = gyroBeta
  }

  if (gyroBaseGamma === null) {
    gyroBaseGamma = gyroGamma
  }
}

arStartButton.addEventListener('click', startARMode)

// =====================
// ライト設定
// =====================

const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 2)
directionalLight.position.set(3, 5, 5)
scene.add(directionalLight)

// =====================
// 読み込み中表示
// =====================

const loadingText = document.createElement('div')
loadingText.className = 'loading-text'
loadingText.textContent = '読み込み中...'
app.appendChild(loadingText)

// =====================
// モデル管理
// =====================

const loader = new GLTFLoader()

const modelRoot = new THREE.Group()
scene.add(modelRoot)

const layers = [
  {
    id: 'layer1',
    label: '第1層',
    objectName: '889_1danme',
    object: null,
    visible: true,
  },
  {
    id: 'layer2',
    label: '第2層',
    objectName: '889_2danme',
    object: null,
    visible: false,
  },
  {
    id: 'layer3',
    label: '第3層',
    objectName: '889_3danme',
    object: null,
    visible: false,
  },
  {
    id: 'layer4',
    label: '第4層',
    objectName: '889_4danme',
    object: null,
    visible: false,
  },
]

// =====================
// GLB読み込み
// =====================

function loadModel() {
  loader.load(
    `${import.meta.env.BASE_URL}models/889.glb`,

    // 読み込み成功
    (gltf) => {
      const model = gltf.scene
      modelRoot.add(model)

      console.log('GLB loaded:', model)

      model.traverse((child) => {
        console.log('object:', child.name, child.type)

        if (child.isMesh) {
          child.castShadow = false
          child.receiveShadow = false
        }
      })

      // レイヤー対象オブジェクトを取得
      layers.forEach((layer) => {
        const target = model.getObjectByName(layer.objectName)

        if (!target) {
          console.warn(`${layer.objectName} が見つかりません`)
          return
        }

        layer.object = target
      })

      fitModelToView()
      applyLayerVisibility()
      updateLayerButtons()

      // 読み込み表示を消す
      loadingText.style.display = 'none'
    },

    // 読み込み進行中
    (progress) => {
      if (!progress.total) return

      const percent = Math.round((progress.loaded / progress.total) * 100)
      loadingText.textContent = `読み込み中... ${percent}%`
    },

    // 読み込み失敗
    (error) => {
      console.error('889.glb の読み込みに失敗:', error)
      loadingText.textContent = 'モデルの読み込みに失敗しました'
    }
  )
}

// =====================
// レイヤー表示反映
// =====================

function applyLayerVisibility() {
  layers.forEach((layer) => {
    if (!layer.object) return
    layer.object.visible = layer.visible
  })
}

// =====================
// モデルを画面内に収める
// =====================

function fitModelToView() {
  // 全層を一時的に表示して、全体サイズを正しく計算する
  const previousVisibleStates = []

  layers.forEach((layer) => {
    if (!layer.object) return

    previousVisibleStates.push({
      object: layer.object,
      visible: layer.object.visible,
    })

    layer.object.visible = true
  })

  const box = new THREE.Box3().setFromObject(modelRoot)

  // 元の表示状態に戻す
  previousVisibleStates.forEach((item) => {
    item.object.visible = item.visible
  })

  const size = new THREE.Vector3()
  const center = new THREE.Vector3()

  box.getSize(size)
  box.getCenter(center)

  console.log('model size:', size)
  console.log('model center:', center)

  if (size.length() === 0) return

  // X/Z方向は中央合わせ
  modelRoot.position.x = -center.x
  modelRoot.position.z = -center.z

  // Y方向は少し下げる
  modelRoot.position.y = -center.y - size.y * 0.15

  // モデルの大きさを画面に合わせる
  const maxSize = Math.max(size.x, size.y, size.z)
  const targetSize = 2.5
  const baseScale = targetSize / maxSize

  modelRoot.userData.baseScale = baseScale
  modelRoot.scale.setScalar(baseScale)

  console.log('baseScale:', baseScale)
}

// =====================
// UI作成
// =====================

const ui = document.createElement('div')
ui.className = 'ui'
app.appendChild(ui)

const title = document.createElement('div')
title.className = 'title'
title.textContent = 'maibun_ar'
ui.appendChild(title)

const layerButtons = document.createElement('div')
layerButtons.className = 'layer-buttons'
ui.appendChild(layerButtons)

// =====================
// レイヤーボタン生成
// =====================

function createLayerButtons() {
  layers
    .slice()
    .reverse()
    .forEach((layer) => {
      const button = document.createElement('button')
      button.textContent = layer.label
      button.dataset.layerId = layer.id

      button.addEventListener('click', () => {
        layer.visible = !layer.visible
        applyLayerVisibility()
        updateLayerButtons()
      })

      layerButtons.appendChild(button)
    })
}

function updateLayerButtons() {
  const buttons = layerButtons.querySelectorAll('button')

  buttons.forEach((button) => {
    const layer = layers.find((item) => item.id === button.dataset.layerId)
    if (!layer) return

    button.classList.toggle('active', layer.visible)
  })
}

// =====================
// 操作設定：調整用パラメータ
// =====================

const ROTATE_SPEED = 0.01
const PAN_SPEED = 0.005
const WHEEL_ZOOM_SPEED = 0.001
const PINCH_ZOOM_SPEED = 0.01

const MIN_ZOOM = 0.4
const MAX_ZOOM = 3.0

let isDragging = false
let dragMode = null
let previousX = 0
let previousY = 0
let zoomScale = 1

// =====================
// ジャイロ設定
// =====================

// ジャイロが有効か
let gyroEnabled = false

// 端末の傾き
let gyroBeta = 0   // 前後の傾き
let gyroGamma = 0  // 左右の傾き

// ジャイロの基準値
let gyroBaseBeta = null
let gyroBaseGamma = null

// ジャイロの効き具合
// 大きくすると傾きへの反応が強くなる
const GYRO_ROTATE_STRENGTH = 0.01

// =====================
// PC操作
// =====================

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch') return

  isDragging = true
  previousX = event.clientX
  previousY = event.clientY

  if (event.button === 1) {
    dragMode = 'pan'
  } else {
    dragMode = 'rotate'
  }
})

renderer.domElement.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return
  if (!isDragging) return

  const deltaX = event.clientX - previousX
  const deltaY = event.clientY - previousY

  if (dragMode === 'pan') {
    modelRoot.position.x += deltaX * PAN_SPEED
    modelRoot.position.y -= deltaY * PAN_SPEED
  } else {
    modelRoot.rotation.y += deltaX * ROTATE_SPEED
    modelRoot.rotation.x += deltaY * ROTATE_SPEED
  }

  previousX = event.clientX
  previousY = event.clientY
})

renderer.domElement.addEventListener('pointerup', () => {
  isDragging = false
  dragMode = null
})

renderer.domElement.addEventListener('pointerleave', () => {
  isDragging = false
  dragMode = null
})

renderer.domElement.addEventListener('auxclick', (event) => {
  event.preventDefault()
})

renderer.domElement.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault()

    zoomScale += -event.deltaY * WHEEL_ZOOM_SPEED
    zoomScale = THREE.MathUtils.clamp(zoomScale, MIN_ZOOM, MAX_ZOOM)

    applyZoom()
  },
  { passive: false }
)

// =====================
// スマホ / タブレット操作
// =====================

let touchMode = null
let lastTouchX = 0
let lastTouchY = 0
let lastPinchDistance = 0

function getTouchCenter(touches) {
  const x = (touches[0].clientX + touches[1].clientX) / 2
  const y = (touches[0].clientY + touches[1].clientY) / 2
  return { x, y }
}

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

renderer.domElement.addEventListener(
  'touchstart',
  (event) => {
    if (isARMode) return
    event.preventDefault()

    if (event.touches.length === 1) {
      touchMode = 'rotate'
      lastTouchX = event.touches[0].clientX
      lastTouchY = event.touches[0].clientY
    }

    if (event.touches.length === 2) {
      touchMode = 'panZoom'

      const center = getTouchCenter(event.touches)
      lastTouchX = center.x
      lastTouchY = center.y

      lastPinchDistance = getTouchDistance(event.touches)
    }
  },
  { passive: false }
)

renderer.domElement.addEventListener(
  'touchmove',
  (event) => {
    if (isARMode) return
    event.preventDefault()

    if (touchMode === 'rotate' && event.touches.length === 1) {
      const currentX = event.touches[0].clientX
      const currentY = event.touches[0].clientY

      const deltaX = currentX - lastTouchX
      const deltaY = currentY - lastTouchY

      modelRoot.rotation.y += deltaX * ROTATE_SPEED
      modelRoot.rotation.x += deltaY * ROTATE_SPEED

      lastTouchX = currentX
      lastTouchY = currentY
    }

    if (touchMode === 'panZoom' && event.touches.length === 2) {
      const center = getTouchCenter(event.touches)
      const currentDistance = getTouchDistance(event.touches)

      const deltaX = center.x - lastTouchX
      const deltaY = center.y - lastTouchY
      const deltaDistance = currentDistance - lastPinchDistance

      modelRoot.position.x += deltaX * PAN_SPEED
      modelRoot.position.y -= deltaY * PAN_SPEED

      zoomScale += deltaDistance * PINCH_ZOOM_SPEED
      zoomScale = THREE.MathUtils.clamp(zoomScale, MIN_ZOOM, MAX_ZOOM)

      applyZoom()

      lastTouchX = center.x
      lastTouchY = center.y
      lastPinchDistance = currentDistance
    }
  },
  { passive: false }
)

renderer.domElement.addEventListener('touchend', () => {
  touchMode = null
  lastPinchDistance = 0
})

renderer.domElement.addEventListener('touchcancel', () => {
  touchMode = null
  lastPinchDistance = 0
})

// =====================
// 拡大縮小反映
// =====================

function applyZoom() {
  const baseScale = modelRoot.userData.baseScale || 1
  modelRoot.scale.setScalar(baseScale * zoomScale)
}

// =====================
// 画面サイズ変更対応
// =====================

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()

  renderer.setSize(window.innerWidth, window.innerHeight)
})

// =====================
// 初期実行
// =====================

createLayerButtons()
loadModel()

// =====================
// 描画ループ
// =====================

function animate() {
  requestAnimationFrame(animate)

  if (gyroEnabled && gyroBaseBeta !== null && gyroBaseGamma !== null) {
    const deltaBeta = gyroBeta - gyroBaseBeta
    const deltaGamma = gyroGamma - gyroBaseGamma

    // 左右傾きでY回転
    modelRoot.rotation.y += deltaGamma * GYRO_ROTATE_STRENGTH * 0.01

    // 前後傾きでX回転
    modelRoot.rotation.x += deltaBeta * GYRO_ROTATE_STRENGTH * 0.01
  }

  renderer.render(scene, camera)
}

animate()