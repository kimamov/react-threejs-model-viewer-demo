import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, MutableRefObject } from 'react'
import ModelCanvas from './ModelCanvas'

type ModelOption = {
  id: string
  name: string
  url: string
  isLocal?: boolean
}

type TextureOption = {
  id: string
  name: string
  url: string
  isLocal?: boolean
}

type StickerTransform = {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
}

const defaultModels: ModelOption[] = [
  {
    id: 'astronaut',
    name: 'Astronaut (sample)',
    url: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
  },
  {
    id: 'helmet',
    name: 'Damaged Helmet (sample)',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
  },
  {
    id: 'duck',
    name: 'Duck (Khronos sample)',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb',
  },
]

const defaultTextures: TextureOption[] = [
  {
    id: 'uv-grid',
    name: 'UV Grid',
    url: 'https://threejs.org/examples/textures/uv_grid_opengl.jpg',
  },
  {
    id: 'metal',
    name: 'Brushed Metal',
    url: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/metal/Metal_Plate_037_basecolor.jpg',
  },
  {
    id: 'fabric',
    name: 'Blue Fabric',
    url: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/fabric/fabric_04_basecolor.jpg',
  },
]

const initialModelId = defaultModels[0]?.id ?? ''

function buildObjectUrl(file: File, bucket: MutableRefObject<string[]>) {
  const url = URL.createObjectURL(file)
  bucket.current.push(url)
  return url
}

const defaultStickerTransform: StickerTransform = {
  position: [0, 0.25, 0],
  rotation: [0, 0, 0],
  scale: 0.5,
}

function FileInput({
  id,
  label,
  accept,
  onSelect,
}: {
  id: string
  label: string
  accept: string
  onSelect: (file: File) => void
}) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onSelect(file)
      event.target.value = ''
    }
  }

  return (
    <label className="file-input" htmlFor={id}>
      <div className="file-input__label">
        <span>{label}</span>
        <small>({accept})</small>
      </div>
      <input id={id} type="file" accept={accept} onChange={handleChange} />
    </label>
  )
}

export default function App() {
  const [models, setModels] = useState<ModelOption[]>(defaultModels)
  const [textures, setTextures] = useState<TextureOption[]>(defaultTextures)
  const [selectedModelId, setSelectedModelId] = useState<string>(initialModelId)
  const [selectedTextureId, setSelectedTextureId] = useState<string | null>(null)
  const [stickerUrl, setStickerUrl] = useState<string | null>(null)
  const [stickerTransform, setStickerTransform] =
    useState<StickerTransform>(defaultStickerTransform)

  const modelObjectUrls = useRef<string[]>([])
  const textureObjectUrls = useRef<string[]>([])
  const stickerObjectUrls = useRef<string[]>([])

  useEffect(
    () => () => {
      modelObjectUrls.current.forEach((url) => URL.revokeObjectURL(url))
      textureObjectUrls.current.forEach((url) => URL.revokeObjectURL(url))
      stickerObjectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    },
    [],
  )

  useEffect(() => {
    if (!models.find((model) => model.id === selectedModelId) && models[0]) {
      setSelectedModelId(models[0].id)
    }
  }, [models, selectedModelId])

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? models[0],
    [models, selectedModelId],
  )

  const selectedTexture = useMemo(
    () => textures.find((texture) => texture.id === selectedTextureId) ?? null,
    [textures, selectedTextureId],
  )

  const handleStickerUpload = (file: File) => {
    const url = buildObjectUrl(file, stickerObjectUrls)
    setStickerUrl(url)
  }

  const handleModelUpload = (file: File) => {
    const url = buildObjectUrl(file, modelObjectUrls)
    const newModel: ModelOption = {
      id: `${file.name}-${Date.now()}`,
      name: file.name,
      url,
      isLocal: true,
    }
    setModels((prev) => [...prev, newModel])
    setSelectedModelId(newModel.id)
  }

  const handleTextureUpload = (file: File) => {
    const url = buildObjectUrl(file, textureObjectUrls)
    const newTexture: TextureOption = {
      id: `${file.name}-${Date.now()}`,
      name: file.name,
      url,
      isLocal: true,
    }
    setTextures((prev) => [...prev, newTexture])
    setSelectedTextureId(newTexture.id)
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <p className="eyebrow">React Three Model Viewer</p>
          <h1>Pick a model, swap textures, explore in 3D</h1>
          <p className="lede">
            Choose a built-in GLTF/GLB or upload your own. Textures can be swapped live
            without reloading the geometry. Orbit the camera to inspect every detail.
          </p>
        </div>
        <div className="tag">PBR + Orbit Controls</div>
      </header>

      <div className="layout">
        <section className="panel">
          <div className="card">
            <div className="card__header">
              <div>
                <h2>Model</h2>
                <p>Select an existing GLTF/GLB or upload a new one.</p>
              </div>
            </div>
            <div className="field">
              <label htmlFor="model-select">Choose model</label>
              <select
                id="model-select"
                value={selectedModelId}
                onChange={(event) => setSelectedModelId(event.target.value)}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
            <FileInput
              id="model-upload"
              label="Upload GLTF/GLB"
              accept=".glb,.gltf"
              onSelect={handleModelUpload}
            />
            <p className="hint">Uploaded models are added to the dropdown automatically.</p>
          </div>

          <div className="card">
            <div className="card__header">
              <div>
                <h2>Texture</h2>
                <p>Swap textures live without reloading the model.</p>
              </div>
            </div>
            <div className="field">
              <label htmlFor="texture-select">Choose texture</label>
              <select
                id="texture-select"
                value={selectedTextureId ?? ''}
                onChange={(event) => setSelectedTextureId(event.target.value || null)}
              >
                <option value="">Use model materials</option>
                {textures.map((texture) => (
                  <option key={texture.id} value={texture.id}>
                    {texture.name}
                    {texture.isLocal ? ' (uploaded)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <FileInput
              id="texture-upload"
              label="Upload texture image"
              accept="image/*"
              onSelect={handleTextureUpload}
            />
            <p className="hint">
              JPG/PNG work best. The selected texture is applied to all mesh materials without
              reloading the GLTF.
            </p>
          </div>

          <div className="card">
            <div className="card__header">
              <div>
                <h2>Sticker</h2>
                <p>Project a PNG sticker onto the model.</p>
              </div>
            </div>
            <FileInput
              id="sticker-upload"
              label="Upload PNG sticker"
              accept="image/png"
              onSelect={handleStickerUpload}
            />
            <div className="field-row">
              <div className="field">
                <label>Position X</label>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={stickerTransform.position[0]}
                  onChange={(e) =>
                    setStickerTransform((t) => ({
                      ...t,
                      position: [Number(e.target.value), t.position[1], t.position[2]],
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Position Y</label>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={stickerTransform.position[1]}
                  onChange={(e) =>
                    setStickerTransform((t) => ({
                      ...t,
                      position: [t.position[0], Number(e.target.value), t.position[2]],
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Position Z</label>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={stickerTransform.position[2]}
                  onChange={(e) =>
                    setStickerTransform((t) => ({
                      ...t,
                      position: [t.position[0], t.position[1], Number(e.target.value)],
                    }))
                  }
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Rotation X (deg)</label>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={stickerTransform.rotation[0]}
                  onChange={(e) =>
                    setStickerTransform((t) => ({
                      ...t,
                      rotation: [Number(e.target.value), t.rotation[1], t.rotation[2]],
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Rotation Y (deg)</label>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={stickerTransform.rotation[1]}
                  onChange={(e) =>
                    setStickerTransform((t) => ({
                      ...t,
                      rotation: [t.rotation[0], Number(e.target.value), t.rotation[2]],
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Rotation Z (deg)</label>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={stickerTransform.rotation[2]}
                  onChange={(e) =>
                    setStickerTransform((t) => ({
                      ...t,
                      rotation: [t.rotation[0], t.rotation[1], Number(e.target.value)],
                    }))
                  }
                />
              </div>
            </div>
            <div className="field">
              <label>Scale</label>
              <input
                type="range"
                min={0.1}
                max={2}
                step={0.01}
                value={stickerTransform.scale}
                onChange={(e) =>
                  setStickerTransform((t) => ({ ...t, scale: Number(e.target.value) }))
                }
              />
            </div>
            <div className="actions">
              <button
                type="button"
                onClick={() => {
                  setStickerTransform(defaultStickerTransform)
                }}
              >
                Reset sticker transform
              </button>
              <button type="button" onClick={() => setStickerUrl(null)}>
                Clear sticker
              </button>
            </div>
          </div>
        </section>

        <section className="viewer">
          {selectedModel ? (
            <ModelCanvas
              modelUrl={selectedModel.url}
              textureUrl={selectedTexture?.url}
              stickerUrl={stickerUrl}
              stickerTransform={stickerTransform}
            />
          ) : (
            <div className="empty">Add a model to get started.</div>
          )}
        </section>
      </div>
    </div>
  )
}

