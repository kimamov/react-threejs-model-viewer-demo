import { Canvas, useFrame } from '@react-three/fiber'
import {
  ContactShadows,
  Decal,
  Environment,
  Html,
  OrbitControls,
  useGLTF,
} from '@react-three/drei'
import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ACESFilmicToneMapping,
  Box3,
  DataTexture,
  Group,
  LinearFilter,
  Material,
  Mesh,
  MeshStandardMaterial,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from 'three'

type ModelCanvasProps = {
  modelUrl: string
  textureUrl?: string | null
  stickerUrl?: string | null
  stickerTransform?: {
    position: [number, number, number]
    rotation: [number, number, number]
    scale: number
  }
}

class ModelErrorBoundary extends Component<
  { resetKey: string; children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { resetKey: string; children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error) {
    console.error('Model load failed', error)
  }

  render() {
    if (this.state.error) {
      return (
        <Html center>
          <div className="loader">
            <div className="loader__bar" />
            <p>Could not load model.</p>
            <small>Check the URL or try another file.</small>
          </div>
        </Html>
      )
    }
    return this.props.children
  }
}

function LoadingOverlay() {
  return (
    <Html center>
      <div className="loader">
        <div className="loader__bar" />
        <p>Loading...</p>
      </div>
    </Html>
  )
}

function Model({ modelUrl, textureUrl, stickerUrl, stickerTransform }: ModelCanvasProps) {
  const gltf = useGLTF(modelUrl, true)
  const groupRef = useRef<Group>(null)
  const originalMaps = useRef<WeakMap<Material, Texture | null>>(new WeakMap())
  const [texture, setTexture] = useState<Texture | null>(null)
  const [stickerTexture, setStickerTexture] = useState<Texture | null>(null)
  const materialsRef = useRef<MeshStandardMaterial[]>([])
  const stickerTargetRef = useRef<Mesh | null>(null)
  const fallbackTexture = useMemo(() => {
    const data = new Uint8Array([255, 255, 255, 255])
    const tex = new DataTexture(data, 1, 1, RGBAFormat)
    tex.needsUpdate = true
    tex.colorSpace = SRGBColorSpace
    tex.minFilter = LinearFilter
    tex.magFilter = LinearFilter
    return tex
  }, [])
  const noiseTexture = useMemo(() => {
    const size = 128
    const data = new Uint8Array(size * size * 4)
    for (let i = 0; i < size * size; i++) {
      const v = Math.random() * 255
      data[i * 4 + 0] = v
      data[i * 4 + 1] = v
      data[i * 4 + 2] = v
      data[i * 4 + 3] = 255
    }
    const tex = new DataTexture(data, size, size, RGBAFormat)
    tex.needsUpdate = true
    tex.colorSpace = SRGBColorSpace
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.minFilter = LinearFilter
    tex.magFilter = LinearFilter
    return tex
  }, [])

  useEffect(() => {
    if (!textureUrl) {
      setTexture(null)
      return
    }

    let cancelled = false
    const loader = new TextureLoader()
    loader.setCrossOrigin('anonymous')
    // Reset current texture immediately so the next apply is in sync with the selection
    setTexture(null)

    loader.load(
      textureUrl,
      (loaded: Texture) => {
        if (cancelled) return
        loaded.colorSpace = SRGBColorSpace
        loaded.wrapS = RepeatWrapping
        loaded.wrapT = RepeatWrapping
        setTexture(loaded)
      },
      undefined,
      () => {
        if (!cancelled) setTexture(null)
      },
    )

    return () => {
      cancelled = true
    }
  }, [textureUrl])

  useEffect(() => {
    const scene = gltf.scene
    scene.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh
        if (!stickerTargetRef.current) {
          stickerTargetRef.current = mesh
        }
        mesh.castShadow = true
        mesh.receiveShadow = true

        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.forEach((material) => {
          const standardMaterial = material as MeshStandardMaterial
          if (!originalMaps.current.has(material)) {
            originalMaps.current.set(material, standardMaterial.map ?? null)
          }

          if (!standardMaterial.userData.__patched) {
            standardMaterial.onBeforeCompile = (shader) => {
              shader.uniforms.uPrevMap = { value: standardMaterial.map ?? fallbackTexture }
              shader.uniforms.uNextMap = { value: standardMaterial.map ?? fallbackTexture }
              shader.uniforms.uNoiseMap = { value: noiseTexture }
              shader.uniforms.uMix = { value: 1 }
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_pars_fragment>',
                `
                #include <map_pars_fragment>
                uniform sampler2D uPrevMap;
                uniform sampler2D uNextMap;
                uniform sampler2D uNoiseMap;
                uniform float uMix;
                `,
              )
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                `
                #ifdef USE_MAP
                  vec4 texPrev = texture2D( uPrevMap, vMapUv );
                  vec4 texNext = texture2D( uNextMap, vMapUv );
                  float noise = texture2D( uNoiseMap, vMapUv * 8.0 + vec2(uMix * 2.0) ).r;
                  float mixProgress = clamp(uMix, 0.0, 1.0);
                  float noiseEdge = smoothstep(mixProgress - 0.2, mixProgress + 0.2, noise);
                  float blend = max(noiseEdge, mixProgress);
                  vec4 texelColor = mix(texPrev, texNext, blend);
                  diffuseColor *= texelColor;
                #endif
                `,
              )
              standardMaterial.userData.blendUniforms = shader.uniforms
            }
            standardMaterial.userData.__patched = true
            standardMaterial.needsUpdate = true
          }

          if (standardMaterial.metalness === undefined) {
            standardMaterial.metalness = 0.2
          }
          if (standardMaterial.roughness === undefined) {
            standardMaterial.roughness = 0.6
          }

          if (!standardMaterial.userData.originalMap) {
            standardMaterial.userData.originalMap = standardMaterial.map ?? null
          }
          if (!materialsRef.current.includes(standardMaterial)) {
            materialsRef.current.push(standardMaterial)
          }
        })
      }
    })
  }, [gltf.scene, texture, fallbackTexture, noiseTexture])

  useEffect(() => {
    materialsRef.current.forEach((material) => {
      const originalMap = originalMaps.current.get(material) ?? fallbackTexture
      const currentApplied = material.userData.currentMap ?? originalMap
      const nextMap = texture ?? originalMap
      const uniforms = material.userData.blendUniforms
      if (uniforms) {
        uniforms.uPrevMap.value = currentApplied
        uniforms.uNextMap.value = nextMap
        uniforms.uMix.value = 0
      }
      material.userData.currentMap = nextMap
      material.userData.transitionProgress = 0
    })
  }, [texture, fallbackTexture])

  useEffect(() => {
    if (!stickerUrl) {
      setStickerTexture(null)
      return
    }
    let cancelled = false
    const loader = new TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      stickerUrl,
      (loaded: Texture) => {
        if (cancelled) return
        loaded.colorSpace = SRGBColorSpace
        loaded.wrapS = RepeatWrapping
        loaded.wrapT = RepeatWrapping
        setStickerTexture(loaded)
      },
      undefined,
      () => {
        if (!cancelled) setStickerTexture(null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [stickerUrl])

  useEffect(() => {
    if (!groupRef.current) return
    const box = new Box3().setFromObject(groupRef.current)
    const size = box.getSize(new Vector3())
    const maxAxis = Math.max(size.x, size.y, size.z)
    const scale = maxAxis > 0 ? 2.4 / maxAxis : 1
    groupRef.current.scale.setScalar(scale)
    box.setFromObject(groupRef.current)
    const center = box.getCenter(new Vector3())
    groupRef.current.position.sub(center)
  }, [modelUrl])

  useFrame((_, delta) => {
    materialsRef.current.forEach((material) => {
      const uniforms = material.userData.blendUniforms
      if (!uniforms) return
      const progress = material.userData.transitionProgress ?? 1
      if (progress < 1) {
        const duration = 0.8
        const next = Math.min(1, progress + delta / duration)
        uniforms.uMix.value = next
        material.userData.transitionProgress = next
      }
    })

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15
    }
  })

  return (
    <group ref={groupRef} dispose={null}>
      <primitive object={gltf.scene} />
      {stickerTexture && stickerTransform && stickerTargetRef.current ? (
        <Decal
          mesh={stickerTargetRef as unknown as React.RefObject<Mesh>}
          position={stickerTransform.position}
          rotation={stickerTransform.rotation.map((deg) => (deg * Math.PI) / 180) as [
            number,
            number,
            number,
          ]}
          scale={stickerTransform.scale}
        >
          <meshStandardMaterial
            map={stickerTexture}
            transparent
            alphaTest={0.01}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-4}
            roughness={1}
            metalness={0}
            toneMapped={false}
          />
        </Decal>
      ) : null}
    </group>
  )
}

export default function ModelCanvas({
  modelUrl,
  textureUrl,
  stickerUrl,
  stickerTransform,
}: ModelCanvasProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [2.5, 1.8, 3.2], fov: 50 }}
      gl={{ toneMapping: ACESFilmicToneMapping, antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#0b1021']} />
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[5, 5, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <Suspense fallback={<LoadingOverlay />}>
        <ModelErrorBoundary resetKey={`${modelUrl}-${textureUrl ?? 'none'}`}>
          <Model
            modelUrl={modelUrl}
            textureUrl={textureUrl}
            stickerUrl={stickerUrl}
            stickerTransform={stickerTransform}
          />
        </ModelErrorBoundary>
        <ContactShadows
          position={[0, -0.8, 0]}
          opacity={0.6}
          scale={8}
          blur={1.5}
          far={2.5}
        />
        <Environment preset="studio" background={false} />
      </Suspense>
      <OrbitControls
        enableDamping
        enablePan={false}
        minDistance={1}
        maxDistance={9}
        maxPolarAngle={Math.PI / 1.9}
      />
    </Canvas>
  )
}

