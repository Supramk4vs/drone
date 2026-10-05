import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Drone, SensorSpectrum, WeaponType } from '../types/tactical';

interface TacticalViewport3DProps {
  drones: Drone[];
  selectedDroneId: string | null;
  onSelectDrone: (id: string) => void;
  spectrum: SensorSpectrum;
  zoomLevel: number;
  activeWeapon: WeaponType;
  isFiring: boolean;
  timeOfDay: 'NIGHT' | 'DAY' | 'DUSK';
  onCameraSlewed?: (azimuth: number, elevation: number) => void;
}

export const TacticalViewport3D: React.FC<TacticalViewport3DProps> = ({
  drones,
  selectedDroneId,
  onSelectDrone,
  spectrum,
  zoomLevel,
  activeWeapon,
  isFiring,
  timeOfDay,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  
  // Drone meshes map
  const droneMeshesRef = useRef<Map<string, {
    group: THREE.Group;
    rotors: THREE.Mesh[];
    fireMesh?: THREE.Points;
  }>>(new Map());

  // Turret meshes
  const radarDishRef = useRef<THREE.Group | null>(null);
  const flakTurretRef = useRef<THREE.Group | null>(null);
  const laserTurretRef = useRef<THREE.Group | null>(null);

  // Environment lights & terrain refs for Morning / Night switching
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const groundMeshRef = useRef<THREE.Mesh | null>(null);

  // Weapon FX meshes
  const laserBeamRef = useRef<THREE.Line | null>(null);
  const laserCoreRef = useRef<THREE.Mesh | null>(null);
  const flakTracersRef = useRef<Array<{ mesh: THREE.Mesh; progress: number; origin: THREE.Vector3; target: THREE.Vector3 }>>([]);
  const explosionsRef = useRef<Array<{ group: THREE.Group; age: number; maxAge: number }>>([]);
  const jammerConeRef = useRef<THREE.Mesh | null>(null);
  const spoofRingRef = useRef<THREE.Mesh | null>(null);

  // Camera angles
  const yawRef = useRef<number>(0); // radians
  const pitchRef = useRef<number>(0.15); // radians
  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(55, width / height, 1, 6000);
    camera.position.set(0, 12, 0); // At base observation post
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Setup base environment & terrain
    buildEnvironment(scene, timeOfDay);

    // Build Forward Operating Base structures
    buildFOB(scene);

    // Build weapon FX templates
    buildWeaponEffects(scene);

    // Handle Resize
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Mouse drag controls for pan/tilt
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - prevMouseRef.current.x;
      const dy = e.clientY - prevMouseRef.current.y;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };

      const sensitivity = 0.0035 / (zoomLevel || 1);
      yawRef.current -= dx * sensitivity;
      pitchRef.current -= dy * sensitivity;

      // Clamp pitch between -30 deg and +85 deg
      pitchRef.current = Math.max(-0.4, Math.min(1.45, pitchRef.current));
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    // Mobile Touch Gesture Orbit Handlers
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDraggingRef.current = true;
        prevMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - prevMouseRef.current.x;
      const dy = e.touches[0].clientY - prevMouseRef.current.y;
      prevMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      const sensitivity = 0.004 / (zoomLevel || 1);
      yawRef.current -= dx * sensitivity;
      pitchRef.current -= dy * sensitivity;
      pitchRef.current = Math.max(-0.4, Math.min(1.45, pitchRef.current));
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Rotate radar dish
      if (radarDishRef.current) {
        radarDishRef.current.rotation.y = elapsed * 1.5;
      }

      // Update camera orientation
      if (cameraRef.current) {
        const cosPitch = Math.cos(pitchRef.current);
        const sinPitch = Math.sin(pitchRef.current);
        const sinYaw = Math.sin(yawRef.current);
        const cosYaw = Math.cos(yawRef.current);

        const lookDir = new THREE.Vector3(
          sinYaw * cosPitch,
          sinPitch,
          -cosYaw * cosPitch
        ).normalize();

        const camPos = cameraRef.current.position;
        cameraRef.current.lookAt(
          camPos.x + lookDir.x * 100,
          camPos.y + lookDir.y * 100,
          camPos.z + lookDir.z * 100
        );
      }

      // Animate explosions
      for (let i = explosionsRef.current.length - 1; i >= 0; i--) {
        const expl = explosionsRef.current[i];
        expl.age += delta;
        const progress = expl.age / expl.maxAge;
        if (progress >= 1) {
          scene.remove(expl.group);
          explosionsRef.current.splice(i, 1);
        } else {
          expl.group.scale.setScalar(1 + progress * 8);
          expl.group.traverse((child) => {
            if ((child as THREE.Mesh).material) {
              const mat = (child as THREE.Mesh).material as THREE.Material;
              mat.opacity = 1 - progress;
            }
          });
        }
      }

      // Animate Flak Tracers
      for (let i = flakTracersRef.current.length - 1; i >= 0; i--) {
        const tracer = flakTracersRef.current[i];
        tracer.progress += delta * 4.5;
        if (tracer.progress >= 1) {
          // Trigger airburst explosion at target
          triggerExplosion(scene, tracer.target, false);
          scene.remove(tracer.mesh);
          flakTracersRef.current.splice(i, 1);
        } else {
          tracer.mesh.position.lerpVectors(tracer.origin, tracer.target, tracer.progress);
        }
      }

      // Rotate propellers of all drones
      droneMeshesRef.current.forEach((item) => {
        item.rotors.forEach((rotor) => {
          rotor.rotation.y += 35 * delta;
        });
      });

      // Animate Jammer Wave Cone
      if (jammerConeRef.current && jammerConeRef.current.visible) {
        jammerConeRef.current.rotation.z += delta * 3;
        const mat = jammerConeRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.25 + Math.sin(elapsed * 12) * 0.15;
      }

      // Animate Spoofing Ring
      if (spoofRingRef.current && spoofRingRef.current.visible) {
        spoofRingRef.current.rotation.x += delta * 2;
        spoofRingRef.current.rotation.y += delta * 1.5;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      domEl.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update zoom (FOV)
  useEffect(() => {
    if (!cameraRef.current) return;
    const baseFov = 55;
    cameraRef.current.fov = baseFov / Math.max(1, zoomLevel);
    cameraRef.current.updateProjectionMatrix();
  }, [zoomLevel]);

  // Update time of day / spectrum background & colors
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current) return;
    const scene = sceneRef.current;

    if (spectrum === 'NVG') {
      scene.background = new THREE.Color(0x021608);
      scene.fog = new THREE.FogExp2(0x03220f, 0.0014);
    } else if (spectrum === 'FLIR') {
      scene.background = new THREE.Color(0x07090b);
      scene.fog = new THREE.FogExp2(0x0c1015, 0.0016);
    } else {
      if (timeOfDay === 'NIGHT') {
        scene.background = new THREE.Color(0x03060c);
        scene.fog = new THREE.FogExp2(0x040810, 0.0011);
        if (ambientLightRef.current) {
          ambientLightRef.current.color.setHex(0x223344);
          ambientLightRef.current.intensity = 0.45;
        }
        if (sunLightRef.current) {
          sunLightRef.current.color.setHex(0x5588cc);
          sunLightRef.current.intensity = 0.6;
        }
        if (groundMeshRef.current) {
          (groundMeshRef.current.material as THREE.MeshStandardMaterial).color.setHex(0x111a20);
        }
      } else if (timeOfDay === 'DUSK') {
        scene.background = new THREE.Color(0x351e26);
        scene.fog = new THREE.FogExp2(0x351e26, 0.0009);
        if (ambientLightRef.current) {
          ambientLightRef.current.color.setHex(0x886655);
          ambientLightRef.current.intensity = 0.8;
        }
        if (sunLightRef.current) {
          sunLightRef.current.color.setHex(0xff7744);
          sunLightRef.current.intensity = 1.3;
        }
        if (groundMeshRef.current) {
          (groundMeshRef.current.material as THREE.MeshStandardMaterial).color.setHex(0x221c1a);
        }
      } else {
        // MORNING / DAY MODE: Bright morning alpine sky & golden directional sun
        scene.background = new THREE.Color(0x5092c2);
        scene.fog = new THREE.FogExp2(0x6e9ec0, 0.0005);
        if (ambientLightRef.current) {
          ambientLightRef.current.color.setHex(0xc2e2fa);
          ambientLightRef.current.intensity = 1.3;
        }
        if (sunLightRef.current) {
          sunLightRef.current.color.setHex(0xfff7e8);
          sunLightRef.current.intensity = 2.0;
          sunLightRef.current.position.set(600, 700, -500);
        }
        if (groundMeshRef.current) {
          (groundMeshRef.current.material as THREE.MeshStandardMaterial).color.setHex(0x2d3a2f);
        }
      }
    }
  }, [spectrum, timeOfDay]);

  // Synchronize 3D Drone Meshes with props.drones
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const activeIds = new Set(drones.map((d) => d.id));

    // Remove old meshes
    droneMeshesRef.current.forEach((item, id) => {
      if (!activeIds.has(id)) {
        scene.remove(item.group);
        droneMeshesRef.current.delete(id);
      }
    });

    // Add or update drones
    drones.forEach((drone) => {
      let droneItem = droneMeshesRef.current.get(drone.id);

      if (!droneItem) {
        // Create 3D drone model based on type
        const group = buildDrone3D(drone.type);
        scene.add(group);
        const rotors: THREE.Mesh[] = [];
        group.traverse((child) => {
          if (child.name === 'rotor') rotors.push(child as THREE.Mesh);
        });
        droneItem = { group, rotors };
        droneMeshesRef.current.set(drone.id, droneItem);
      }

      // Update position
      droneItem.group.position.set(drone.position[0], drone.position[1], drone.position[2]);

      // Align heading
      droneItem.group.rotation.y = (drone.heading * Math.PI) / 180;

      // Spectrum appearance styling
      droneItem.group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            const mat = mesh.material as THREE.MeshStandardMaterial;

            if (spectrum === 'FLIR') {
              // Thermal White-Hot / High heat glow
              if (child.name === 'battery' || child.name === 'motor') {
                if (mat.color) mat.color.setHex(0xffffff); // Super bright white hot
                if (mat.emissive) {
                  mat.emissive.setHex(0xff8800);
                  mat.emissiveIntensity = 1.8;
                }
              } else {
                if (mat.color) mat.color.setHex(0xaaaaaa);
                if (mat.emissive) {
                  mat.emissive.setHex(0x334455);
                  mat.emissiveIntensity = 0.5;
                }
              }
            } else if (spectrum === 'NVG') {
              // NVG Phosphor green
              if (mat.color) mat.color.setHex(0x38e858);
              if (mat.emissive) {
                mat.emissive.setHex(0x187028);
                mat.emissiveIntensity = 0.6;
              }
            } else {
              // Day / Standard military matte
              if (child.name === 'battery') {
                if (mat.color) mat.color.setHex(0x111111);
                if (mat.emissive) {
                  mat.emissive.setHex(0x000000);
                  mat.emissiveIntensity = 0;
                }
              } else {
                if (mat.color) mat.color.setHex(drone.isHostile ? 0x3d4349 : 0x2288bb);
                if (mat.emissive) {
                  mat.emissive.setHex(drone.id === selectedDroneId ? 0x00ffaa : 0x000000);
                  mat.emissiveIntensity = drone.id === selectedDroneId ? 0.4 : 0;
                }
              }
            }
          }
        }
      });

      // If destroyed or crashing
      if (drone.status === 'CRASHING') {
        droneItem.group.rotation.x += 0.2;
        droneItem.group.rotation.z += 0.3;
      }
      if (drone.status === 'DESTROYED') {
        droneItem.group.visible = false;
      } else {
        droneItem.group.visible = true;
      }
    });
  }, [drones, spectrum, selectedDroneId]);

  // Handle Weapon Firing Visual Effects
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const selectedDrone = drones.find((d) => d.id === selectedDroneId);

    // 1. LASER DEW
    if (activeWeapon === 'LASER_DEW' && isFiring && selectedDrone) {
      if (laserBeamRef.current && laserCoreRef.current) {
        laserBeamRef.current.visible = true;
        laserCoreRef.current.visible = true;

        const turretPos = new THREE.Vector3(15, 12, 5); // Laser turret pos
        const targetPos = new THREE.Vector3(
          selectedDrone.position[0],
          selectedDrone.position[1],
          selectedDrone.position[2]
        );

        // Update line geometry
        const lineGeo = laserBeamRef.current.geometry;
        lineGeo.setFromPoints([turretPos, targetPos]);

        // Position laser spark core at target
        laserCoreRef.current.position.copy(targetPos);
      }
    } else {
      if (laserBeamRef.current) laserBeamRef.current.visible = false;
      if (laserCoreRef.current) laserCoreRef.current.visible = false;
    }

    // 2. RF JAMMER
    if (activeWeapon === 'RF_JAMMER' && isFiring && selectedDrone && jammerConeRef.current) {
      jammerConeRef.current.visible = true;
      const jammerPos = new THREE.Vector3(-15, 14, 5);
      const targetPos = new THREE.Vector3(
        selectedDrone.position[0],
        selectedDrone.position[1],
        selectedDrone.position[2]
      );
      jammerConeRef.current.position.copy(jammerPos);
      jammerConeRef.current.lookAt(targetPos);
      const dist = jammerPos.distanceTo(targetPos);
      jammerConeRef.current.scale.set(dist * 0.15, dist * 0.15, dist);
    } else if (jammerConeRef.current) {
      jammerConeRef.current.visible = false;
    }

    // 3. GPS SPOOFING
    if (activeWeapon === 'GPS_SPOOF' && isFiring && selectedDrone && spoofRingRef.current) {
      spoofRingRef.current.visible = true;
      spoofRingRef.current.position.set(
        selectedDrone.position[0],
        selectedDrone.position[1],
        selectedDrone.position[2]
      );
    } else if (spoofRingRef.current) {
      spoofRingRef.current.visible = false;
    }
  }, [activeWeapon, isFiring, selectedDroneId, drones]);

  // Hook for single-shot weapon effects (Flak burst)
  useEffect(() => {
    if (activeWeapon === 'KINETIC_FLAK' && isFiring && selectedDroneId && sceneRef.current) {
      const selectedDrone = drones.find((d) => d.id === selectedDroneId);
      if (!selectedDrone) return;

      const origin = new THREE.Vector3(0, 10, 8); // Flak turret
      const target = new THREE.Vector3(
        selectedDrone.position[0],
        selectedDrone.position[1],
        selectedDrone.position[2]
      );

      // Create glowing tracer bullet mesh
      const tracerGeo = new THREE.SphereGeometry(1.2, 8, 8);
      const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffaa22 });
      const tracerMesh = new THREE.Mesh(tracerGeo, tracerMat);
      tracerMesh.position.copy(origin);
      sceneRef.current.add(tracerMesh);

      flakTracersRef.current.push({
        mesh: tracerMesh,
        progress: 0,
        origin,
        target,
      });
    }
  }, [isFiring]);

  // Auto-slew camera towards selected drone when requested
  const slewCameraToDrone = (drone: Drone) => {
    const dx = drone.position[0] - 0;
    const dy = drone.position[1] - 12;
    const dz = drone.position[2] - 0;
    const groundDist = Math.sqrt(dx * dx + dz * dz);

    yawRef.current = Math.atan2(dx, -dz);
    pitchRef.current = Math.atan2(dy, groundDist);
  };

  // Build Environment Helper
  const buildEnvironment = (scene: THREE.Scene, tod: string) => {
    // Ambient light
    const amb = new THREE.AmbientLight(
      tod === 'DAY' ? 0xffffff : tod === 'DUSK' ? 0x886655 : 0x223344,
      tod === 'DAY' ? 1.2 : 0.4
    );
    scene.add(amb);
    ambientLightRef.current = amb;

    // Sun / Moon Directional Light
    const sun = new THREE.DirectionalLight(
      tod === 'DAY' ? 0xfffaed : tod === 'DUSK' ? 0xff7744 : 0x5588cc,
      tod === 'DAY' ? 1.5 : 0.6
    );
    sun.position.set(500, 800, -600);
    scene.add(sun);
    sunLightRef.current = sun;

    // Terrain ground plane with defensive terrain grid
    const terrainGeo = new THREE.PlaneGeometry(6000, 6000, 64, 64);
    const posAttr = terrainGeo.attributes.position;
    // Add mountainous perimeter ridges
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const r = Math.sqrt(vx * vx + vy * vy);
      if (r > 600) {
        const height = Math.sin(vx * 0.003) * Math.cos(vy * 0.003) * 160 + (r - 600) * 0.12;
        posAttr.setZ(i, Math.max(0, height));
      }
    }
    terrainGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x141e24,
      roughness: 0.9,
      metalness: 0.1,
      wireframe: false,
    });
    const ground = new THREE.Mesh(terrainGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);
    groundMeshRef.current = ground;

    // Tactical Coordinate Grid ring on ground
    const grid = new THREE.GridHelper(3000, 60, 0x00ffaa, 0x114433);
    grid.position.y = 0.5;
    scene.add(grid);

    // Perimeter Defense Rings
    [500, 1000, 2000].forEach((radius) => {
      const ringGeo = new THREE.RingGeometry(radius - 2, radius + 2, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: radius === 500 ? 0xff3344 : radius === 1000 ? 0xffaa00 : 0x00ffaa,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 1;
      scene.add(ring);
    });
  };

  // Build Forward Operating Base (FOB)
  const buildFOB = (scene: THREE.Scene) => {
    const fobGroup = new THREE.Group();

    // Command Bunker Shelter
    const bunkerGeo = new THREE.BoxGeometry(40, 12, 30);
    const bunkerMat = new THREE.MeshStandardMaterial({ color: 0x243038, roughness: 0.7 });
    const bunker = new THREE.Mesh(bunkerGeo, bunkerMat);
    bunker.position.set(0, 6, 0);
    fobGroup.add(bunker);

    // Reinforced Observation Deck on roof
    const deckGeo = new THREE.CylinderGeometry(14, 16, 4, 16);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x18242c });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(0, 14, 0);
    fobGroup.add(deck);

    // AN/TPQ-53 Radar Tower & Rotating Dish
    const radarTowerGeo = new THREE.CylinderGeometry(2, 3, 24, 8);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x334450 });
    const radarTower = new THREE.Mesh(radarTowerGeo, towerMat);
    radarTower.position.set(-25, 12, -20);
    fobGroup.add(radarTower);

    const dishGroup = new THREE.Group();
    dishGroup.position.set(-25, 25, -20);
    const dishGeo = new THREE.CylinderGeometry(6, 6, 1, 16, 1, false, 0, Math.PI);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0x00ffaa, wireframe: true });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.rotation.x = Math.PI / 2;
    dishGroup.add(dish);
    radarDishRef.current = dishGroup;
    fobGroup.add(dishGroup);

    // 30mm Kinetic Flak CIWS Turret
    const flakGroup = new THREE.Group();
    flakGroup.position.set(0, 10, 15);
    const flakBaseGeo = new THREE.CylinderGeometry(4, 5, 4, 12);
    const flakBase = new THREE.Mesh(flakBaseGeo, new THREE.MeshStandardMaterial({ color: 0x1f2933 }));
    flakGroup.add(flakBase);
    const barrelGeo = new THREE.CylinderGeometry(0.5, 0.5, 8, 8);
    const barrel = new THREE.Mesh(barrelGeo, new THREE.MeshStandardMaterial({ color: 0x111111 }));
    barrel.rotation.x = Math.PI / 3;
    barrel.position.set(0, 4, 3);
    flakGroup.add(barrel);
    flakTurretRef.current = flakGroup;
    fobGroup.add(flakGroup);

    // High Energy Laser (DEW) Turret
    const laserGroup = new THREE.Group();
    laserGroup.position.set(25, 10, -10);
    const laserBase = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 4, 12), new THREE.MeshStandardMaterial({ color: 0x22303c }));
    laserGroup.add(laserBase);
    const laserAperture = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 16), new THREE.MeshStandardMaterial({ color: 0x00eeff, emissive: 0x005577 }));
    laserAperture.position.set(0, 3, 0);
    laserGroup.add(laserAperture);
    laserTurretRef.current = laserGroup;
    fobGroup.add(laserGroup);

    scene.add(fobGroup);
  };

  // Weapon FX Templates
  const buildWeaponEffects = (scene: THREE.Scene) => {
    // 1. Continuous Laser DEW beam line
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 10),
    ]);
    const laserMat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      linewidth: 3,
    });
    const laserLine = new THREE.Line(laserGeo, laserMat);
    laserLine.visible = false;
    scene.add(laserLine);
    laserBeamRef.current = laserLine;

    // Laser impact plasma sphere
    const coreGeo = new THREE.SphereGeometry(2.5, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.visible = false;
    scene.add(coreMesh);
    laserCoreRef.current = coreMesh;

    // 2. RF Jammer electromagnetic cone
    const coneGeo = new THREE.ConeGeometry(1, 1, 16, 1, true);
    coneGeo.rotateX(-Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x00bfff,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const jammerCone = new THREE.Mesh(coneGeo, coneMat);
    jammerCone.visible = false;
    scene.add(jammerCone);
    jammerConeRef.current = jammerCone;

    // 3. GPS Spoofing cyber holographic ring
    const ringGeo = new THREE.TorusGeometry(8, 0.4, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
    });
    const spoofRing = new THREE.Mesh(ringGeo, ringMat);
    spoofRing.visible = false;
    scene.add(spoofRing);
    spoofRingRef.current = spoofRing;
  };

  // Helper: Trigger Mid-Air Fragmentation Explosion
  const triggerExplosion = (scene: THREE.Scene, position: THREE.Vector3, isBig: boolean = false) => {
    const group = new THREE.Group();
    group.position.copy(position);

    // Fireball
    const fireGeo = new THREE.SphereGeometry(isBig ? 12 : 6, 12, 12);
    const fireMat = new THREE.MeshBasicMaterial({
      color: 0xff4411,
      transparent: true,
      opacity: 0.9,
    });
    const fire = new THREE.Mesh(fireGeo, fireMat);
    group.add(fire);

    // Shrapnel debris ring
    const debrisGeo = new THREE.RingGeometry(1, isBig ? 18 : 10, 16);
    const debrisMat = new THREE.MeshBasicMaterial({
      color: 0xffaa22,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const debris = new THREE.Mesh(debrisGeo, debrisMat);
    debris.rotation.x = Math.random() * Math.PI;
    group.add(debris);

    scene.add(group);
    explosionsRef.current.push({
      group,
      age: 0,
      maxAge: 0.8,
    });
  };

  // Helper: Build detailed 3D Drone Model
  const buildDrone3D = (type: Drone['type']): THREE.Group => {
    const group = new THREE.Group();

    if (type === 'LOITERING_MUNITION') {
      // Fixed-Wing Delta Loitering Munition (Shahed / Switchblade style)
      const bodyGeo = new THREE.ConeGeometry(1.2, 7, 8);
      bodyGeo.rotateX(Math.PI / 2);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3b4248, roughness: 0.5 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      group.add(body);

      // Delta Wings
      const wingGeo = new THREE.BoxGeometry(8, 0.2, 2.5);
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x2e353b });
      const wings = new THREE.Mesh(wingGeo, wingMat);
      wings.position.set(0, 0, -1);
      group.add(wings);

      // Tail fins
      const finGeo = new THREE.BoxGeometry(0.2, 1.8, 1.2);
      const finMat = new THREE.MeshStandardMaterial({ color: 0x242a30 });
      const finL = new THREE.Mesh(finGeo, finMat);
      finL.position.set(-3.5, 0.8, -2);
      const finR = new THREE.Mesh(finGeo, finMat);
      finR.position.set(3.5, 0.8, -2);
      group.add(finL);
      group.add(finR);

      // Rear Pusher Propeller
      const propGeo = new THREE.BoxGeometry(2.4, 0.1, 0.3);
      const propMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
      const prop = new THREE.Mesh(propGeo, propMat);
      prop.name = 'rotor';
      prop.position.set(0, 0, -3.6);
      group.add(prop);

      // Warhead payload marker
      const noseGeo = new THREE.SphereGeometry(0.8, 8, 8);
      const noseMat = new THREE.MeshStandardMaterial({ color: 0xcc2222 });
      const nose = new THREE.Mesh(noseGeo, noseMat);
      nose.name = 'battery';
      nose.position.set(0, 0, 3.2);
      group.add(nose);
    } else {
      // Quadcopter or Hexacopter
      const isHexa = type === 'HEAVY_HEXA_BOMBER';
      const armCount = isHexa ? 6 : 4;
      const armLength = isHexa ? 3.5 : 2.0;

      // Central Hub
      const hubGeo = new THREE.CylinderGeometry(0.8, 0.9, 0.6, 8);
      const hubMat = new THREE.MeshStandardMaterial({ color: 0x2b333a, roughness: 0.6 });
      const hub = new THREE.Mesh(hubGeo, hubMat);
      group.add(hub);

      // LiPo Battery pack (Critical thermal signature)
      const batGeo = new THREE.BoxGeometry(1.2, 0.8, 1.8);
      const batMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
      const bat = new THREE.Mesh(batGeo, batMat);
      bat.name = 'battery';
      bat.position.set(0, 0.6, 0);
      group.add(bat);

      // Forward FPV Camera lens
      const camGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.6, 8);
      camGeo.rotateX(Math.PI / 2);
      const camMat = new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x003322 });
      const cam = new THREE.Mesh(camGeo, camMat);
      cam.position.set(0, 0, 1.2);
      group.add(cam);

      // Droppable Ordnance for Heavy Bomber
      if (isHexa) {
        const bombGeo = new THREE.CylinderGeometry(0.6, 0.6, 2.2, 8);
        const bombMat = new THREE.MeshStandardMaterial({ color: 0x882222 });
        const bomb = new THREE.Mesh(bombGeo, bombMat);
        bomb.position.set(0, -1.2, 0);
        group.add(bomb);
      }

      // Arms & Rotors
      for (let i = 0; i < armCount; i++) {
        const angle = (i * (2 * Math.PI)) / armCount;
        const armX = Math.cos(angle) * armLength;
        const armZ = Math.sin(angle) * armLength;

        // Arm rod
        const armGeo = new THREE.CylinderGeometry(0.12, 0.12, armLength, 6);
        armGeo.rotateZ(Math.PI / 2);
        armGeo.rotateY(-angle);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x1f2429 });
        const arm = new THREE.Mesh(armGeo, armMat);
        arm.position.set(armX * 0.5, 0, armZ * 0.5);
        group.add(arm);

        // Motor pod
        const motorGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.4, 8);
        const motorMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
        const motor = new THREE.Mesh(motorGeo, motorMat);
        motor.name = 'motor';
        motor.position.set(armX, 0.2, armZ);
        group.add(motor);

        // Propeller
        const propGeo = new THREE.BoxGeometry(1.6, 0.05, 0.2);
        const propMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7 });
        const prop = new THREE.Mesh(propGeo, propMat);
        prop.name = 'rotor';
        prop.position.set(armX, 0.45, armZ);
        group.add(prop);
      }
    }

    return group;
  };

  const selectedDrone = drones.find((d) => d.id === selectedDroneId);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-black">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-crosshair" />

      {/* Spectrum Simulation Post-Processing Overlays */}
      {spectrum === 'NVG' && (
        <div className="absolute inset-0 pointer-events-none nvg-vignette scanlines-overlay bg-[#00ff44]/10 mix-blend-color" />
      )}
      {spectrum === 'FLIR' && (
        <div className="absolute inset-0 pointer-events-none flir-vignette scanlines-overlay bg-[#00ddff]/5" />
      )}

      {/* Crosshair & Lead Angle Reticle HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {/* Outer Optical Ring */}
        <div className={`w-52 h-52 rounded-full border border-dashed transition-all duration-300 ${
          spectrum === 'NVG' ? 'border-[#2bf656]/30' : spectrum === 'FLIR' ? 'border-[#00e5ff]/30' : 'border-[#00ffaa]/25'
        }`}>
          {/* Compass / Azimuth Heading Marks */}
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-[#00ffaa] bg-black/70 px-1.5 py-0.2 border border-[#00ffaa]/30 rounded">
            AZ: {Math.round((yawRef.current * 180) / Math.PI + 360) % 360}° | EL: {Math.round((pitchRef.current * 180) / Math.PI)}°
          </div>
        </div>

        {/* Center Crosshair */}
        <div className="absolute w-8 h-8 flex items-center justify-center">
          <div className="w-full h-[1px] bg-[#00ffaa]/80" />
          <div className="h-full w-[1px] bg-[#00ffaa]/80 absolute" />
          <div className="w-2 h-2 rounded-full border border-[#00ffaa]/70" />
        </div>

        {/* Pitch Ladder Indicators */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-7 opacity-25 text-[8.5px] text-[#00ffaa]">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-[1px] bg-[#00ffaa]" /> +10° <span className="w-4 h-[1px] bg-[#00ffaa]" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-7 h-[1px] bg-[#00ffaa]" /> 00° <span className="w-7 h-[1px] bg-[#00ffaa]" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-[1px] bg-[#00ffaa]" /> -10° <span className="w-4 h-[1px] bg-[#00ffaa]" />
          </div>
        </div>
      </div>

      {/* Target Lock Reticle Box on Selected Drone */}
      {selectedDrone && selectedDrone.status !== 'DESTROYED' && (
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-2">
          <button
            onClick={() => slewCameraToDrone(selectedDrone)}
            className="px-2.5 py-1 bg-[#0b1c16]/90 hover:bg-[#00ffaa]/20 border border-[#00ffaa]/60 text-[#00ffaa] text-[10px] font-mono rounded flex items-center gap-1.5 shadow-md backdrop-blur transition-all"
          >
            <span>🎯</span>
            <span>AUTO-SLEW TO TARGET</span>
          </button>
        </div>
      )}

      {/* Sensor Spectrum Banner in Viewport */}
      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 bg-[#081215]/85 border border-[#183238] px-2 py-1 rounded backdrop-blur text-[10px] font-mono">
        <div className={`w-2 h-2 rounded-full ${
          spectrum === 'NVG' ? 'bg-[#2bf656] animate-pulse' : spectrum === 'FLIR' ? 'bg-[#00bfff] animate-pulse' : 'bg-[#00ffaa]'
        }`} />
        <span className="text-gray-400">SENSOR:</span>
        <span className="font-bold text-[#00ffaa]">
          {spectrum === 'NVG' ? 'NVG (GREEN PHOSPHOR)' : spectrum === 'FLIR' ? 'FLIR THERMAL (MWIR)' : 'DAYLIGHT EO'}
        </span>
        <span className="text-gray-500">|</span>
        <span className="text-[#ffaa00]">{zoomLevel}X</span>
      </div>

      {/* Lead-Angle & Telemetry Annotations for Locked Target */}
      {selectedDrone && (
        <div className="absolute bottom-3 left-3 z-10 bg-[#081215]/90 border border-[#16382e] p-2 rounded font-mono text-[10px] text-[#00ffaa] backdrop-blur space-y-0.5 shadow-xl max-w-xs">
          <div className="flex items-center justify-between border-b border-[#16382e] pb-0.5 font-bold">
            <span className="text-white">{selectedDrone.callsign}</span>
            <span className={selectedDrone.isHostile ? 'text-[#ff3344]' : 'text-[#00ffaa]'}>
              [{selectedDrone.isHostile ? 'HOSTILE' : 'CIVILIAN'}]
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-0.5 text-gray-300 text-[9.5px]">
            <div>RANGE: <span className="text-[#00ffaa] font-bold">{selectedDrone.range}m</span></div>
            <div>ALT: <span className="text-[#00ffaa]">{selectedDrone.altitude}m</span></div>
            <div>SPEED: <span className="text-[#00ffaa]">{selectedDrone.speed}m/s</span></div>
            <div>TTI: <span className="text-[#ff3344] font-bold">{selectedDrone.timeToImpact}s</span></div>
          </div>
        </div>
      )}
    </div>
  );
};
