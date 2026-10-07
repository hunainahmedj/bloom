import { expect, it } from 'vitest';
import { Box3, InstancedMesh, Mesh } from 'three';
import { createCrown } from '../src/crown';

it('builds an actual 3D ring with flowers, leaves, and finite geometry', () => {
  const crown = createCrown();
  expect(crown.getObjectByName('vine')).toBeTruthy();
  expect(crown.getObjectByName('flowers')!.children.length).toBeGreaterThanOrEqual(12);
  expect((crown.getObjectByName('Leaf blades') as InstancedMesh).count).toBeGreaterThanOrEqual(24);
  const box = new Box3().setFromObject(crown);
  expect(box.max.x - box.min.x).toBeGreaterThan(2);
  expect(box.max.z - box.min.z).toBeGreaterThan(1.5);
  expect(box.max.y - box.min.y).toBeGreaterThan(.2);
  let vertices = 0;
  crown.traverse(o => {
    if (o instanceof Mesh) {
      const positions = o.geometry.getAttribute('position');
      vertices += positions.count;
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
    }
  });
  expect(vertices).toBeGreaterThan(1000);
});
