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

// =====================
// Three.js 基本設定
// =====================

// 3D空間
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x202020)

// カメラ
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
)
camera.position.set(0, 0, 5)

// 描画装置
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
})

renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
app.appendChild(renderer.domElement)

// =====================
// ライト設定
// =====================

// 全体を明るくするライト
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
scene.add(ambientLight)

// 斜め前から当てるライト
const directionalLight = new THREE.DirectionalLight(0xffffff, 2)
directionalLight.position.set(3, 5, 5)
scene.add(directionalLight)

// =====================
// モデル管理
// =====================

// GLB読み込み用
const loader = new GLTFLoader()

// モデル全体をまとめる親
const modelRoot = new THREE.Group()
scene.add(modelRoot)

// レイヤー設定
// objectName は Blender のアウトライナー上のオブジェクト名と一致させる
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

// GLB読み込み
function loadModel() {
loader.load(
  `${import.meta.env.BASE_URL}models/889.glb`,

    // 読み込み成功
    (gltf) => {
      const model = gltf.scene
      modelRoot.add(model)

      // GLB内のオブジェクト名確認用ログ
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
        target.visible = layer.visible
      })

      fitModelToView()
      updateLayerButtons()
    },

    // 読み込み進行中
    undefined,

    // 読み込み失敗
    (error) => {
      console.error('889.glb の読み込みに失敗:', error)
    }
  )
}

// モデルを画面内に収める
function fitModelToView() {
  // いったん全オブジェクトを対象にしてサイズ計算
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

  modelRoot.position.x = -center.x
  modelRoot.position.z = -center.z
  modelRoot.position.y = -center.y - size.y * 1.5

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

// タイトル
const title = document.createElement('div')
title.className = 'title'
title.textContent = 'maibun_ar'
ui.appendChild(title)

// レイヤーボタン置き場
const layerButtons = document.createElement('div')
layerButtons.className = 'layer-buttons'
ui.appendChild(layerButtons)

// レイヤーボタン生成
function createLayerButtons() {
  // 表示順は上から第4層、第3層、第2層、第1層
  layers
    .slice()
    .reverse()
    .forEach((layer) => {
      const button = document.createElement('button')
      button.textContent = layer.label
      button.dataset.layerId = layer.id

      button.addEventListener('click', () => {
        layer.visible = !layer.visible

        if (layer.object) {
          layer.object.visible = layer.visible
        }

        updateLayerButtons()
      })

      layerButtons.appendChild(button)
    })
}

// レイヤーボタンの見た目更新
function updateLayerButtons() {
  const buttons = layerButtons.querySelectorAll('button')

  buttons.forEach((button) => {
    const layer = layers.find((item) => item.id === button.dataset.layerId)
    if (!layer) return

    button.classList.toggle('active', layer.visible)
  })
}

// =====================
// 操作設定：共通パラメータ
// =====================

// ここを変更すると操作感を調整できる
const ROTATE_SPEED = 0.01
const PAN_SPEED = 0.005
const WHEEL_ZOOM_SPEED = 0.001
const PINCH_ZOOM_SPEED = 0.01

// 拡大縮小の限界
const MIN_ZOOM = 0.4
const MAX_ZOOM = 3.0

let isDragging = false
let dragMode = null
let previousX = 0
let previousY = 0
let zoomScale = 1

// =====================
// PC操作
// =====================

// 左ドラッグ：回転
// 中央ボタンドラッグ：平行移動
// ホイール：拡大縮小

renderer.domElement.addEventListener('pointerdown', (event) => {
  // タッチ操作は下の touch 系で処理する
  if (event.pointerType === 'touch') return

  isDragging = true
  previousX = event.clientX
  previousY = event.clientY

  // 中央ボタンなら平行移動
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
    // 平行移動
    modelRoot.position.x += deltaX * PAN_SPEED
    modelRoot.position.y -= deltaY * PAN_SPEED
  } else {
    // 回転
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

// 中央ボタンの余計な動作を防ぐ
renderer.domElement.addEventListener('auxclick', (event) => {
  event.preventDefault()
})

// ホイール拡大縮小
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

// 1本指ドラッグ：回転
// 2本指ドラッグ：平行移動
// 2本指ピンチ：拡大縮小

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

      // 2本指の中心移動で平行移動
      modelRoot.position.x += deltaX * PAN_SPEED
      modelRoot.position.y -= deltaY * PAN_SPEED

      // 指の距離変化で拡大縮小
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
  renderer.render(scene, camera)
}

animate()
