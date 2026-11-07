import { STARTER } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vesselMissions, vesselNotifications, vesselOrders, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, get, pass, placeShip, post, type StarterWorld } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

interface Contact { id: string; kind: string; from: object; to: object; startAt: string; endAt: string; fleet?: object; inbound?: true; owner?: string; [k: string]: unknown }
interface Traffic { contacts: Contact[] }
interface Pending { pending: { kind: string; id?: string; targetName: string; arriveAt: string; leg?: string; recallable?: boolean; targetPlanetId?: string }[] }

describe('traffic in this galaxy', () => {
  let world: StarterWorld;
  const contacts = async (headers: Record<string, string>) => (await get<Traffic>(world, '/api/starter/traffic', headers)).contacts;
  /** A probe crossing near `watcher`, flown between two others. */
  const flight = async (watcherModules: Record<string, number>, x: number) => {
    const watcher = await aboard(world, 'Watcher', { SURVEY: 1, ...watcherModules });
    const sender = await aboard(world, 'Sender', { SURVEY: 1 });
    const target = await aboard(world, 'Target');
    await placeShip(world, watcher.vesselId, { x: 0 });
    await placeShip(world, sender.vesselId, { x, z: -600 });
    await placeShip(world, target.vesselId, { x, z: 600 });
    await post(world, '/api/starter/probe', sender.headers, { targetPlanetId: target.vesselId });
    world.f.clock.advance(0.75);
    return { watcher, sender, target };
  };

  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  it('shows nothing beyond a ship\'s sensors', async () => {
    const { watcher } = await flight({}, 800);
    expect(await contacts(watcher.headers)).toEqual([]);
  });

  it('on radar alone it is a moving mark of no known kind', async () => {
    const { watcher } = await flight({ RADAR: 1 }, 500);
    const [contact] = await contacts(watcher.headers);
    expect(contact).toMatchObject({ kind: 'unknown' });
    expect(contact!.fleet).toBeUndefined();
  });

  it('inside the telescope it has a kind', async () => {
    const { watcher } = await flight({ TELESCOPE: 1 }, 300);
    expect((await contacts(watcher.headers))[0]).toMatchObject({ kind: 'probe' });
  });

  it('never says who sent it or where it is going', async () => {
    const { watcher, sender, target } = await flight({ TELESCOPE: 1 }, 300);
    const text = JSON.stringify(await contacts(watcher.headers));
    for (const secret of [sender.vesselId, target.vesselId, 'Sender', 'Target']) expect(text).not.toContain(secret);
  });

  it('leaves out one\'s own craft, which the pending list carries', async () => {
    const { sender } = await flight({}, 100);
    expect(await contacts(sender.headers)).toEqual([]);
    const { pending } = await get<Pending>(world, '/api/starter/pending', sender.headers);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ kind: 'probe', targetName: 'Target' });
  });

  it('is empty once it has landed', async () => {
    const { watcher } = await flight({ TELESCOPE: 3 }, 300);
    await pass(world, 10);
    expect(await contacts(watcher.headers)).toEqual([]);
  });

  it('draws a probe coming for you on your radar, and only there', async () => {
    const me = await aboard(world, 'Me', { RADAR: 1 });
    const blind = await aboard(world, 'Blind');
    const sender = await aboard(world, 'Sender', { SURVEY: 1 });
    await placeShip(world, me.vesselId, { x: 0 });
    await placeShip(world, blind.vesselId, { x: 0, z: 900 });
    await placeShip(world, sender.vesselId, { x: 500 });
    await post(world, '/api/starter/probe', sender.headers, { targetPlanetId: me.vesselId });
    world.f.clock.advance(0.1);
    expect((await contacts(me.headers)).length).toBe(1);
    expect(STARTER.radar[1]).toBeGreaterThan(500);
    expect(await contacts(blind.headers)).toEqual([]);
    expect((await world.f.db.select().from(vesselNotifications).where(eq(vesselNotifications.vesselId, blind.vesselId)))).toEqual([]);
  });
  it('keeps an identified trajectory after it leaves the telescope, without revealing an unseen future crossing', async () => {
    const { watcher, sender } = await flight({ TELESCOPE:1 }, 300);
    const start=world.f.clock.now();
    await world.f.db.insert(vesselOrders).values({vesselId:watcher.vesselId,queue:'CONSTRUCTION',slot:0,subject:'TELESCOPE',stage:1,status:'DONE',startedAt:start,readyAt:start,remainingSeconds:0,cost:{alloy:0,crystal:0,deuterium:0}});
    await world.f.db.update(vesselMissions).set({departAt:start,arriveAt:new Date(start.getTime()+600_000),fromX:300,fromY:0,fromZ:-1000,toX:300,toY:0,toZ:1000}).where(eq(vesselMissions.ownerVesselId,sender.vesselId));
    expect(await contacts(watcher.headers)).toEqual([]);
    world.f.clock.advance(5);
    const inside=await contacts(watcher.headers);
    expect(inside[0]).toMatchObject({kind:'probe'});
    world.f.clock.advance(4);
    const outside=await contacts(watcher.headers);
    expect(outside[0]).toMatchObject({id:inside[0]!.id,kind:'probe'});
    expect(JSON.stringify(outside)).not.toContain(sender.vesselId);
  });

  it('does not buy a past encounter when a telescope finishes after the craft has left', async () => {
    const { watcher, sender } = await flight({ RADAR:1 }, 300);
    const start=world.f.clock.now();
    await world.f.db.update(vesselMissions).set({departAt:start,arriveAt:new Date(start.getTime()+600_000),fromX:300,fromY:0,fromZ:-1000,toX:300,toY:0,toZ:1000}).where(eq(vesselMissions.ownerVesselId,sender.vesselId));
    world.f.clock.advance(9);
    await world.f.db.update(vessels).set({modules:{REFINERY:1,TELESCOPE:1,RADAR:1}}).where(eq(vessels.id,watcher.vesselId));
    await world.f.db.insert(vesselOrders).values({vesselId:watcher.vesselId,queue:'CONSTRUCTION',slot:0,subject:'TELESCOPE',stage:1,status:'DONE',startedAt:start,readyAt:world.f.clock.now(),remainingSeconds:0,cost:{alloy:0,crystal:0,deuterium:0}});
    expect(await contacts(watcher.headers)).toEqual([]);
  });

  it('does not remember traffic seen only from a berth it moved to after dormancy', async () => {
    const { watcher, sender } = await flight({ TELESCOPE:1 }, 300);
    const start=world.f.clock.now();
    await world.f.db.insert(vesselOrders).values({vesselId:watcher.vesselId,queue:'CONSTRUCTION',slot:0,subject:'TELESCOPE',stage:1,status:'DONE',startedAt:start,readyAt:start,remainingSeconds:0,cost:{alloy:0,crystal:0,deuterium:0}});
    await world.f.db.update(vessels).set({status:'DORMANT',slotIndex:null,x:5000,y:0,z:0}).where(eq(vessels.id,watcher.vesselId));
    world.f.clock.advance(9);
    expect((await post(world,'/api/starter/repair',watcher.headers,{module:'EXTRACTOR',stage:1})).statusCode).toBe(200);
    const [at]=await world.f.db.select().from(vessels).where(eq(vessels.id,watcher.vesselId));
    await world.f.db.update(vesselMissions).set({departAt:start,arriveAt:new Date(start.getTime()+600_000),fromX:at!.x+300,fromY:at!.y,fromZ:at!.z-1000,toX:at!.x+300,toY:at!.y,toZ:at!.z+1000}).where(eq(vesselMissions.ownerVesselId,sender.vesselId));
    expect(await contacts(watcher.headers)).toEqual([]);
  });

});
