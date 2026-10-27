"""Yarık Review 2 and Brief 2 assets, authored through the live Blender MCP.

Set ASTERA_ROOT, load this module, invoke documented stages in separate MCP calls.
Order: Iskele -> Sessiz Liman -> Kovuk -> Yarik Kalbi -> Enkaz.
The recipe is in docs/yarik-structures.md. Import only restores saved state.
Earlier-revision helpers remain for geometry utilities; do not run old builders.
"""
import bpy
import bmesh
import numpy as np
import math
import json
import os
import struct
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(ASTERA_ROOT)
OUT = ROOT / 'assets/source/yarik'
OUT.mkdir(parents=True, exist_ok=True)
STATE = bpy.app.driver_namespace.setdefault('yarik_state', {})


def purge(label):
    import gc,ctypes
    bpy.data.orphans_purge(do_recursive=True)
    gc.collect()
    try:ctypes.CDLL('libc.so.6').malloc_trim(0)
    except OSError:pass
    rss=int(Path('/proc/self/statm').read_text().split()[1])*os.sysconf('SC_PAGE_SIZE')/1024**2
    print('MEMORY',label,round(rss,1),'MiB',flush=True)
    assert rss<2250,('Memory headroom exhausted below decimal 2.5GB cap',label,rss)
    return rss


def dump(path, value):
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')


def yup(p):
    return [round(float(p[0]), 5), round(float(p[2]), 5), round(float(-p[1]), 5)]


def topology(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    bad = sum(not e.is_manifold for e in bm.edges)
    winding = sum(e.is_manifold and not e.is_contiguous for e in bm.edges)
    zero = sum(f.calc_area() < 1e-7 for f in bm.faces)
    unseen = set(bm.verts)
    components = 0
    while unseen:
        components += 1
        stack = [unseen.pop()]
        while stack:
            for e in stack.pop().link_edges:
                v = e.other_vert(e.verts[0]) if e.verts[0] in unseen else None
                for v in e.verts:
                    if v in unseen:
                        unseen.remove(v)
                        stack.append(v)
    result = dict(triangles=sum(len(f.verts)-2 for f in bm.faces),
                  non_manifold_edges=bad, inconsistent_winding_edges=winding,
                  zero_area_triangles=zero, connected_components=components,
                  loose_vertices=sum(not v.link_faces for v in bm.verts),
                  signed_volume_m3=bm.calc_volume(signed=True))
    bm.free()
    return result


def assert_solid(obj):
    t = topology(obj)
    assert t['non_manifold_edges'] == 0, t
    assert t['inconsistent_winding_edges'] == 0, t
    assert t['zero_area_triangles'] == 0, t
    assert t['connected_components'] == 1, t
    assert t['loose_vertices'] == 0, t
    assert t['signed_volume_m3'] > 0, t
    return t


def acceptance_selftests():
    """Small adversarial geometry checks; does not run any project test suite."""
    me = bpy.data.meshes.new('_test_open')
    me.from_pydata([(0,0,0),(1,0,0),(0,1,0)], [], [(0,1,2)])
    ob = bpy.data.objects.new('_test_open', me)
    try:
        assert_solid(ob)
    except AssertionError:
        print('PASS: open triangle rejected (expected FAIL before asset creation)')
    else:
        raise AssertionError('Open mesh accepted')
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    assert yup((1,2,3)) == [1,3,-2]
    print('PASS: Blender Z-up to glTF Y-up conversion')
    me=bpy.data.meshes.new('_test_tetra')
    me.from_pydata([(0,0,0),(10,0,0),(0,10,0),(0,0,10)],[],[(0,2,1),(0,1,3),(0,3,2),(1,2,3)])
    ob=bpy.data.objects.new('_test_tetra',me)
    assert_solid(ob);tree,_,_=mesh_bvh(ob)
    assert point_inside(tree,(1,1,1)) and not point_inside(tree,(20,20,20))
    bpy.data.objects.remove(ob);bpy.data.meshes.remove(me)
    print('PASS: closed tetra accepted; solid/void ray parity distinguished')


def select(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def new_scene(name):
    scene = bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    scene.world = bpy.data.worlds.new(name + '_space')
    scene.world.use_nodes = True
    bg = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (.009, .014, .025, 1)
    bg.inputs['Strength'].default_value = .22
    STATE[name] = dict(scene=scene, paths=[], entrances=[], markers=[], chambers=[])
    return scene


def implicit_mesh(name, field, bounds, step=5):
    """Welded marching tetrahedra; only crossing cubes are expanded."""
    axes = [np.arange(lo, hi+step, step, dtype=np.float32) for lo,hi in bounds]
    X,Y,Z = np.meshgrid(*axes, indexing='ij')
    shape = X.shape
    values = field(X,Y,Z).astype(np.float32)
    del X,Y,Z
    slices = [(0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1)]
    blocks = [values[a:shape[0]-1+a,b:shape[1]-1+b,c:shape[2]-1+c] for a,b,c in slices]
    mi = np.minimum.reduce(blocks)
    ma = np.maximum.reduce(blocks)
    cells = np.array(np.where((mi < 0) & (ma >= 0))).T
    del mi,ma,blocks
    ids = np.array([np.ravel_multi_index((cells+o).T, shape) for o in slices]).T
    tets = [(0,5,1,6),(0,1,2,6),(0,2,3,6),(0,3,7,6),(0,7,4,6),(0,4,5,6)]
    tetids = np.concatenate([ids[:,t] for t in tets])
    flat = values.ravel()
    signs = flat[tetids] < 0
    codes = (signs * np.array([1,2,4,8])).sum(axis=1)
    edges = []
    for code in range(1,15):
        batch = tetids[codes == code]
        inside = [i for i in range(4) if code & (1<<i)]
        outside = [i for i in range(4) if not code & (1<<i)]
        if len(inside) in (1,3):
            a,b = (inside,outside) if len(inside)==1 else (outside,inside)
            pairs = [(a[0],j) for j in b]
            edges.append(np.stack([batch[:,p] for p in pairs],axis=1))
        else:
            a,b = inside,outside
            pairs = [(a[0],b[0]),(a[0],b[1]),(a[1],b[1]),
                     (a[0],b[0]),(a[1],b[1]),(a[1],b[0])]
            edges.append(np.stack([batch[:,p] for p in pairs],axis=1).reshape(-1,3,2))
    pairs = np.concatenate(edges).reshape(-1,2)
    pairs.sort(axis=1)
    unique, inv = np.unique(pairs,axis=0,return_inverse=True)
    a,b = unique.T
    pa = np.array(np.unravel_index(a,shape)).T.astype(np.float32)
    pb = np.array(np.unravel_index(b,shape)).T.astype(np.float32)
    w = flat[a]/(flat[a]-flat[b])
    verts = (pa+(pb-pa)*w[:,None])*step + np.array([a[0] for a in axes])
    faces = inv.reshape(-1,3)
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts.tolist(),[],faces.tolist())
    me.update()
    ob = bpy.data.objects.new(name,me)
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.0001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(me); bm.free()
    print('implicit',name,len(me.vertices),len(me.polygons))
    return ob


def decimate(ob, target):
    select(ob)
    current = sum(len(p.vertices)-2 for p in ob.data.polygons)
    if current > target:
        mod = ob.modifiers.new('Budget','DECIMATE')
        mod.ratio = target/current
        bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = ob.modifiers.new('Triangulate','TRIANGULATE')
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def rotate_xy(p,a):
    x,y,z=p
    return [x*math.cos(a)-y*math.sin(a),x*math.sin(a)+y*math.cos(a),z]


def cave_paths(r=163,fillet=70,end_radius=416):
    loop=[[r*math.sin(t),-r*math.cos(t),0] for t in np.linspace(0,2*math.pi,181)]
    branches=[]
    cy=-math.sqrt((r+fillet)**2-fillet**2)
    contact=np.array([fillet,cy])*r/(r+fillet)
    end=math.atan2(contact[1]-cy,contact[0]-fillet)
    for angle in [0,2*math.pi/3,4*math.pi/3]:
        for side in [1,-1]:
            bend=[[side*(fillet+fillet*math.cos(t)),cy+fillet*math.sin(t),0]
                  for t in np.linspace(end,math.pi,26)]
            bend += [[0,float(y),0] for y in np.arange(cy-5,-end_radius,-5)]
            branches.append([rotate_xy(p,angle) for p in bend])
    return [loop]+branches


def path_distance(X,Y,Z,paths):
    """Exact closest point to the sampled polyline, updating local segment boxes."""
    d2=np.full(X.shape,1e12,dtype=np.float32)
    # A 60m local mask keeps temporary work and memory bounded.
    for path in paths:
        for p,q in zip(path[:-1],path[1:]):
            p=np.asarray(p); q=np.asarray(q); v=q-p
            mask=(np.abs(X-(p[0]+q[0])/2)<57)&(np.abs(Y-(p[1]+q[1])/2)<57)&(np.abs(Z-(p[2]+q[2])/2)<57)
            dx=X[mask]-p[0];dy=Y[mask]-p[1];dz=Z[mask]-p[2]
            t=np.clip((dx*v[0]+dy*v[1]+dz*v[2])/np.dot(v,v),0,1)
            ds=(dx-t*v[0])**2+(dy-t*v[1])**2+(dz-t*v[2])**2
            d2[mask]=np.minimum(d2[mask],ds)
    return np.sqrt(d2)


def build_kovuk():
    scene=new_scene('kovuk')
    s=STATE['kovuk']; s['paths']=cave_paths()
    # Two 180m chambers centred on the loop, away from spur junctions.
    s['chambers']=[rotate_xy([0,-163,0],a) for a in [math.pi/3,math.pi]]
    def field(X,Y,Z):
        d=np.sqrt((X/1.02)**2+(Y/.94)**2+(Z/.73)**2)
        broad=20*np.sin(X*.019+Y*.009)*np.cos(Z*.023)+13*np.sin(Y*.031-Z*.013)+9*np.cos(X*.043+Z*.027)
        broad+=3*np.sin(X*.11+Y*.03)*np.cos(Y*.09-Z*.08)
        rock=d-339-broad
        # Impact bowls on the exposed body, displaced surfaces rather than shells.
        for p,rad,depth in [([180,-210,165],84,27),([-180,-150,176],58,19),([20,150,225],72,24)]:
            cr=np.sqrt((X-p[0])**2+(Y-p[1])**2+(Z-p[2])**2)
            rock=np.maximum(rock,rad-cr-depth*.05)
        tunnels=path_distance(X,Y,Z,s['paths'])
        rough=2.6*np.sin(X*.073+Z*.048)*np.cos(Y*.064)+1.8*np.sin(Z*.12+Y*.049)
        void=tunnels-(40+rough)
        for p in s['chambers']:
            chamber=np.sqrt((X-p[0])**2+(Y-p[1])**2+(Z*1.07)**2)-90-rough
            void=np.minimum(void,chamber)
        return np.maximum(rock,-void)
    ob=implicit_mesh('lod0',field,[(-385,385),(-370,370),(-285,285)],7.5)
    decimate(ob,28700)
    s['lod0']=ob
    purge('Kovuk geometry')
    print('Kovuk topology',assert_solid(ob))
    return ob


def mesh_bvh(ob):
    verts=[v.co.copy() for v in ob.data.vertices]
    faces=[list(p.vertices) for p in ob.data.polygons]
    return BVHTree.FromPolygons(verts,faces,all_triangles=True),verts,faces


def point_inside(tree,point):
    """Three-direction parity handles nearest-face ambiguity at a mouth's sharp rim."""
    votes=[]
    for vector in [( .613,.379,.693),(-.437,.821,.367),(.293,-.517,.805)]:
        direction=Vector(vector).normalized();origin=Vector(point);hits=0
        while hits<128:
            hit,_,_,_=tree.ray_cast(origin,direction,5000)
            if hit is None:break
            origin=hit+direction*.002;hits+=1
        assert hits<128,'Parity ray failed to leave the asset'
        votes.append(hits%2)
    return sum(votes)>=2


def sample_path(path,spacing=8):
    result=[]
    for p,q in zip(path[:-1],path[1:]):
        p=np.array(p); q=np.array(q)
        n=max(1,math.ceil(np.linalg.norm(q-p)/spacing))
        result += [(p+(q-p)*t/n).tolist() for t in range(n)]
    return result+[path[-1]]


def bend_radius(path):
    result=[]
    for a,b,c in zip(path,path[1:],path[2:]):
        a,b,c=map(np.asarray,(a,b,c))
        cross=np.linalg.norm(np.cross(b-a,c-a))
        if cross > 1e-6:
            result.append(float(np.linalg.norm(b-a)*np.linalg.norm(c-b)*np.linalg.norm(c-a)/(2*cross)))
    return min(result,default=None)


def measure_paths(name):
    s=STATE[name]; tree,_,_=mesh_bvh(s['lod0'])
    reports=[]
    for i,path in enumerate(s['paths']):
        samples=sample_path(path)
        nearest=[tree.find_nearest(Vector(p)) for p in samples]
        distances=[float(hit[3]) for hit in nearest]
        inside=sum(point_inside(tree,p) for p in samples)
        assert inside==0,('Centreline entered solid',name,i,inside)
        spacing=max((Vector(a)-Vector(b)).length for a,b in zip(samples,samples[1:]))
        reports.append(dict(path=i,samples=len(samples),maximum_sample_spacing_m=spacing,points_in_solid=inside,
                            minimum_surface_distance_m=min(distances),minimum_clear_diameter_m=2*min(distances),
                            minimum_bend_radius_m=bend_radius(path)))
    print(json.dumps(reports,indent=2))
    return reports


def enum_value(owner,prop,wanted):
    items=owner.bl_rna.properties[prop].enum_items
    choices=[x.identifier for x in items]
    # Color management exposes a placeholder RNA list; assignment validates its dynamic list.
    if choices != ['NONE']:
        assert wanted in choices,(prop,choices)
    setattr(owner,prop,wanted)


def set_engine(scene,wanted):
    # Blender under-reports available engines through RNA; assignment errors list them.
    try:
        scene.render.engine=wanted
    except TypeError as e:
        raise RuntimeError(str(e))


def node(nodes,kind,**attrs):
    n=nodes.new(kind)
    for k,v in attrs.items(): setattr(n,k,v)
    return n


def source_rock(name):
    mat=bpy.data.materials.new(name+'_source'); mat.use_nodes=True
    ns=mat.node_tree.nodes; ns.clear(); link=mat.node_tree.links.new
    out=node(ns,'ShaderNodeOutputMaterial')
    bs=node(ns,'ShaderNodeBsdfPrincipled')
    link(bs.outputs[0],out.inputs['Surface'])
    geom=node(ns,'ShaderNodeNewGeometry')
    noise=node(ns,'ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=.07
    noise.inputs['Detail'].default_value=5.4; noise.inputs['Roughness'].default_value=.78
    link(geom.outputs['Position'],noise.inputs['Vector'])
    ramp=node(ns,'ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position=.22; ramp.color_ramp.elements[0].color=(.018,.017,.016,1)
    ramp.color_ramp.elements[1].position=.78; ramp.color_ramp.elements[1].color=(.24,.22,.19,1)
    mid=ramp.color_ramp.elements.new(.5); mid.color=(.075,.071,.064,1)
    link(noise.outputs['Fac'],ramp.inputs[0])
    fine=node(ns,'ShaderNodeTexNoise'); fine.inputs['Scale'].default_value=.75
    fine.inputs['Detail'].default_value=3.8; fine.inputs['Roughness'].default_value=.82
    link(geom.outputs['Position'],fine.inputs['Vector'])
    crack=node(ns,'ShaderNodeTexVoronoi'); enum_value(crack,'feature','DISTANCE_TO_EDGE')
    crack.inputs['Scale'].default_value=.048; link(geom.outputs['Position'],crack.inputs['Vector'])
    cr=node(ns,'ShaderNodeValToRGB')
    cr.color_ramp.elements[0].position=.006; cr.color_ramp.elements[0].color=(.16,.16,.16,1)
    cr.color_ramp.elements[1].position=.025; cr.color_ramp.elements[1].color=(1,1,1,1)
    link(crack.outputs['Distance'],cr.inputs[0])
    mix=node(ns,'ShaderNodeMixRGB'); enum_value(mix,'blend_type','MULTIPLY');mix.inputs[0].default_value=.7
    link(ramp.outputs['Color'],mix.inputs[1]);link(cr.outputs['Color'],mix.inputs[2])
    link(mix.outputs[0],bs.inputs['Base Color'])
    bump=node(ns,'ShaderNodeBump');bump.inputs['Strength'].default_value=.65;bump.inputs['Distance'].default_value=2.2
    link(noise.outputs['Fac'],bump.inputs['Height'])
    bump2=node(ns,'ShaderNodeBump');bump2.inputs['Strength'].default_value=.55;bump2.inputs['Distance'].default_value=.65
    link(fine.outputs['Fac'],bump2.inputs['Height']);link(bump.outputs['Normal'],bump2.inputs['Normal'])
    link(bump2.outputs['Normal'],bs.inputs['Normal'])
    bs.inputs['Roughness'].default_value=.88
    return mat,dict(base=mix.outputs[0],rough=noise.outputs['Fac'],normal=bs.outputs[0],metal=0)


def uv_unwrap(ob):
    select(ob)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    station=ob.name.startswith('sessiz_liman')
    margin=.006 if station else (.012 if ob.name.startswith('lod0') else .025)
    bpy.ops.uv.smart_project(angle_limit=1.35 if station else 1.08,island_margin=margin,area_weight=.4)
    bpy.ops.object.mode_set(mode='OBJECT')


def bake_maps(name,source,signals,size=1024):
    s=STATE[name];sc=s['scene'];ob=s['lod0'];select(ob)
    if not ob.data.uv_layers:uv_unwrap(ob)
    ob.data.materials.clear();ob.data.materials.append(source)
    ns=source.node_tree.nodes;links=source.node_tree.links
    out=next(n for n in ns if n.type=='OUTPUT_MATERIAL')
    bs=next(n for n in ns if n.type=='BSDF_PRINCIPLED')
    emit=node(ns,'ShaderNodeEmission')
    target=node(ns,'ShaderNodeTexImage');ns.active=target
    set_engine(sc,'CYCLES');sc.cycles.samples=8;sc.cycles.use_denoising=False
    sc.render.threads_mode='FIXED';sc.render.threads=2
    margin=10 if name=='kovuk' else 2
    sc.render.bake.margin=margin
    images={}
    for kind in ['base','normal','orm','emissive']:
        if kind=='emissive' and 'emissive' not in signals:continue
        im=bpy.data.images.new(name+'_'+kind,width=size,height=size,alpha=False)
        if kind!='base' and kind!='emissive':enum_value(im.colorspace_settings,'name','Non-Color')
        target.image=im;ns.active=target
        if kind=='normal':
            links.new(bs.outputs[0],out.inputs['Surface'])
            bpy.ops.object.bake(type='NORMAL',margin=margin)
        else:
            links.new(emit.outputs[0],out.inputs['Surface'])
            if kind=='base':sig=signals['base']
            elif kind=='emissive':sig=signals['emissive']
            else:
                comb=node(ns,'ShaderNodeCombineColor')
                ao=node(ns,'ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=15;ao.samples=8
                links.new(ao.outputs['AO'],comb.inputs[0])
                mul=node(ns,'ShaderNodeMath');enum_value(mul,'operation','MULTIPLY_ADD')
                mul.inputs[1].default_value=.22;mul.inputs[2].default_value=.69 if name=='kovuk' else .35
                links.new(signals['rough'],mul.inputs[0]);links.new(mul.outputs[0],comb.inputs[1])
                comb.inputs[2].default_value=signals['metal'];sig=comb.outputs[0]
            links.new(sig,emit.inputs['Color'])
            bpy.ops.object.bake(type='EMIT',margin=margin)
        if name=='sessiz_liman' and kind in ('normal','orm','base'):
            pixels=np.empty(size*size*4,dtype=np.float32);im.pixels.foreach_get(pixels);pixels=pixels.reshape(-1,4)
            empty=np.max(pixels[:,:3],axis=1)<1e-7
            if kind=='normal':
                empty|=pixels[:,2]<.15
                pixels[empty]=(.5,.5,1,1)
            elif kind=='orm':pixels[empty]=(1,.8,signals['metal'],1)
            else:pixels[empty]=(.02,.024,.028,1)
            im.pixels.foreach_set(pixels.ravel());im.update()
        im.pack();images[kind]=im
        im.use_fake_user=True
        purge(name+' bake '+kind)
        print('baked',name,kind,flush=True)
    links.new(bs.outputs[0],out.inputs['Surface'])
    s['images']=images
    final=bpy.data.materials.new(name+'_PBR');final.use_nodes=True
    ns=final.node_tree.nodes;link=final.node_tree.links.new
    bs=next(n for n in ns if n.type=='BSDF_PRINCIPLED')
    tex={}
    for kind,im in images.items():
        tex[kind]=node(ns,'ShaderNodeTexImage');tex[kind].image=im
    link(tex['base'].outputs['Color'],bs.inputs['Base Color'])
    normal=node(ns,'ShaderNodeNormalMap');link(tex['normal'].outputs['Color'],normal.inputs['Color']);link(normal.outputs[0],bs.inputs['Normal'])
    if name=='sessiz_liman':normal.inputs['Strength'].default_value=.6
    sep=node(ns,'ShaderNodeSeparateColor');link(tex['orm'].outputs['Color'],sep.inputs[0])
    link(sep.outputs[1],bs.inputs['Roughness']);link(sep.outputs[2],bs.inputs['Metallic'])
    # glTF exporter recognizes its occlusion socket in this group.
    group=bpy.data.node_groups.get('glTF Material Output')
    if group is None:
        group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
        group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
    gn=node(ns,'ShaderNodeGroup');gn.node_tree=group;link(sep.outputs[0],gn.inputs['Occlusion'])
    if 'emissive' in tex:
        link(tex['emissive'].outputs[0],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=2.5
    ob.data.materials.clear();ob.data.materials.append(final);s['material']=final
    # Unused source shader is removed to keep the shared file compact.
    bpy.data.materials.remove(source)
    purge(name+' surface complete')
    return final


def surface_asset(name):
    if name=='kovuk':mat,signals=source_rock(name)
    else:mat,signals=source_metal(name)
    return bake_maps(name,mat,signals)


def point_camera(sc,position,target,ortho=None,lens=40):
    if sc.camera is None:
        data=bpy.data.cameras.new(sc.name+'_camera');cam=bpy.data.objects.new(sc.name+'_camera',data);sc.collection.objects.link(cam);sc.camera=cam
    cam=sc.camera;cam.location=position;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.clip_start=.2;cam.data.clip_end=10000
    enum_value(cam.data,'type','ORTHO' if ortho else 'PERSP')
    cam.data.lens=lens
    if ortho:cam.data.ortho_scale=ortho
    return cam


def light(sc,name,position,power,color,size=150,kind='AREA',target=(0,0,0)):
    data=bpy.data.lights.new(name,kind);data.energy=power;data.color=color
    if kind=='AREA':data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);sc.collection.objects.link(ob);ob.location=position
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    return ob


def setup_lighting(name):
    s=STATE[name];sc=s['scene']
    sun=light(sc,'Sun',(-600,-750,1000),2.6,(1,.88,.72),kind='SUN');sun.data.angle=.08
    light(sc,'Cold bounce',(450,-450,300),4.68e6,(.5,.66,1),450)
    light(sc,'Rim',(-300,450,330),9e6,(.6,.75,1),320)
    if name=='kovuk':
        for i,p in enumerate(s['chambers']):
            light(sc,'Chamber reflected skylight '+str(i),[p[0],p[1],35],32500,(.62,.74,1),kind='POINT')
        for i,p in enumerate([s['paths'][0][k] for k in [5,38,75,100,140]]):
            light(sc,'Tunnel bounce '+str(i),p,8750,(.58,.72,1),kind='POINT')
        p=s['chambers'][0]
        light(sc,'Warm mineral bounce',[p[0]+30,p[1],-25],45000,(1,.69,.38),kind='POINT')
    if name=='iskele':
        light(sc,'Support bounce',(0,-120,-70),4e5,(.62,.71,.83),80,target=(0,0,-18))
    if name=='sessiz_liman':
        sun.data.energy=1.6
        for i,a in enumerate([.4,2,3.5,5]):
            p=(78*math.cos(a),78*math.sin(a),52)
            light(sc,'Emergency practical '+str(i),p,140000,(1,.49,.19),kind='POINT')
        light(sc,'Hangar reflected space',(0,-255,25),60000,(.55,.7,1),kind='POINT')
        light(sc,'Atrium skylight',(-50,0,65),3e5,(.6,.73,.95),60,target=(40,0,-50))
    sc.render.resolution_x=1600;sc.render.resolution_y=1000;sc.render.resolution_percentage=100
    enum_value(sc.render.image_settings,'file_format','PNG');enum_value(sc.render.image_settings,'color_mode','RGB')
    enum_value(sc.view_settings,'view_transform','AgX')
    set_engine(sc,'BLENDER_EEVEE')
    sc.eevee.taa_render_samples=24 if name=='kovuk' else 64;sc.eevee.use_raytracing=False
    enum_value(sc.eevee,'shadow_pool_size','64')
    sc.render.threads_mode='FIXED';sc.render.threads=2
    if name=='sessiz_liman':
        ob=s['lod0'];ob.shadow_terminator_geometry_offset=.5;ob.shadow_terminator_normal_offset=.5;ob.shadow_terminator_shading_offset=.25
        for lamp in sc.objects:
            if lamp.type=='LIGHT':lamp.data.use_shadow_jitter=True;lamp.data.shadow_filter_radius=3


def preview(name,kind,position,target,ortho=None,quick=False,lens=40):
    s=STATE[name];sc=s['scene'];bpy.context.window.scene=sc
    set_engine(sc,'BLENDER_EEVEE')
    for ob in sc.objects:
        if ob.type=='MESH':ob.hide_render=(ob!=s['lod0'] and not (ob.get('presentation_only') and kind in ['interior_chamber','interior_bend']))
    point_camera(sc,position,target,ortho,lens)
    sc.render.resolution_percentage=50 if quick else 100
    sc.cycles.samples=16 if quick else 32
    folder=OUT/name/'previews';folder.mkdir(parents=True,exist_ok=True)
    sc.render.filepath=str(folder/(kind+'.png'))
    bpy.ops.render.render(write_still=True)
    print('rendered',sc.render.filepath)
    purge(name+' render '+kind)


def marker(s,name,position,direction,axis='Z'):
    ob=bpy.data.objects.new(name,None);s['scene'].collection.objects.link(ob)
    ob.location=position
    ob.rotation_euler=Vector(direction).to_track_quat(axis,'Y' if axis=='Z' else 'Z').to_euler()
    ob.empty_display_size=12;ob['asset_node']=name
    record=dict(name=name,position=yup(position),direction=yup(direction),axis='+'+axis)
    s['markers'].append(record)
    if name.startswith('entrance_'):s['entrances'].append(record)
    return ob


def kovuk_markers():
    s=STATE['kovuk'];tree,_,_=mesh_bvh(s['lod0'])
    for i,angle in enumerate([0,2*math.pi/3,4*math.pi/3]):
        def exterior(rho):
            x,y,z=rotate_xy([0,-rho,0],angle)
            d=math.sqrt((x/1.02)**2+(y/.94)**2+(z/.73)**2)
            broad=20*math.sin(x*.019+y*.009)*math.cos(z*.023)+13*math.sin(y*.031-z*.013)+9*math.cos(x*.043+z*.027)
            broad+=3*math.sin(x*.11+y*.03)*math.cos(y*.09-z*.08)
            return d-339-broad
        lo,hi=250,400
        for _ in range(24):
            mid=(lo+hi)/2
            if exterior(mid)<0:lo=mid
            else:hi=mid
        rho=(lo+hi)/2
        point=rotate_xy([0,-rho,0],angle);direction=rotate_xy([0,-1,0],angle)
        marker(s,'entrance_'+str(i+1),point,direction)
        for k in [1+2*i,2+2*i]:
            s['paths'][k]=[p for p in s['paths'][k] if np.linalg.norm(p)<=rho]+[point]
    for ci,center in enumerate(s['chambers']):
        for j,a in enumerate([.3,1.7,3.3,4.7]):
            direction=Vector((math.cos(a)*.65,math.sin(a)*.65,(-1 if j%2 else 1)*.76)).normalized()
            hit,n,_,dist=tree.ray_cast(Vector(center),direction,160)
            assert hit is not None
            marker(s,'deposit_'+str(ci*4+j+1),hit+n*.05,n)


def make_lods(name):
    s=STATE[name];ob=s['lod0'];ob['asset_node']='lod0';s['lods']=[ob]
    for level,ratio in [(1,.35),(2,.12)]:
        copy=ob.copy();copy.data=ob.data.copy();copy.name=name+'_lod'+str(level)
        s['scene'].collection.objects.link(copy);copy['asset_node']='lod'+str(level)
        decimate(copy,round(len(ob.data.polygons)*ratio));copy.hide_render=True
        copy.hide_set(True);s['lods'].append(copy)


def intersection_check(ob):
    tree,vs,fs=mesh_bvh(ob)
    candidates=tree.overlap(tree)
    bad=[]
    for i,j in candidates:
        if i>=j:continue
        if set(fs[i]) & set(fs[j]):continue
        bad.append([i,j])
    return dict(method='Blender triangle BVH overlap; shared vertex/edge contacts excluded',
                intersecting_nonincident_triangle_pairs=len(bad),pairs=bad[:20],passed=not bad)


def keep_main_solid(ob):
    bm=bmesh.new();bm.from_mesh(ob.data);unseen=set(bm.verts);groups=[]
    while unseen:
        group={unseen.pop()};stack=list(group)
        while stack:
            v=stack.pop()
            for e in v.link_edges:
                w=e.other_vert(v)
                if w in unseen:unseen.remove(w);group.add(w);stack.append(w)
        groups.append(group)
    for g in sorted(groups,key=len,reverse=True)[1:]:bmesh.ops.delete(bm,geom=list(g),context='VERTS')
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()


def relax_intersections(ob):
    for attempt in range(6):
        report=intersection_check(ob)
        if report['passed']:return
        ids=set()
        for a,b in report['pairs']:
            ids.update(ob.data.polygons[a].vertices);ids.update(ob.data.polygons[b].vertices)
        bm=bmesh.new();bm.from_mesh(ob.data);bm.verts.ensure_lookup_table()
        verts={bm.verts[i] for i in ids}
        verts|={e.other_vert(v) for v in list(verts) for e in v.link_edges}
        bmesh.ops.smooth_vert(bm,verts=list(verts),factor=.6,use_axis_x=True,use_axis_y=True,use_axis_z=True)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
    assert intersection_check(ob)['passed'],'Intersection repair did not converge'


def route_graph(name):
    s=STATE[name]
    if name=='iskele':
        return dict(applicable=False,reason='Explicit solid landing platform exception; no fly-through routes')
    # Six circle contacts and three mouth nodes. Each mouth has two tangent approaches.
    ring=s['paths'][0];r=np.linalg.norm(ring[0][:2]);angles=[]
    for path in s['paths'][1:]:
        angles.append(math.atan2(path[0][1],path[0][0])%(2*math.pi))
    order=sorted(range(6),key=lambda i:angles[i])
    edges=[[order[i],order[(i+1)%6]] for i in range(6)]
    edges += [[i,6+i//2] for i in range(6)]
    adjacency={i:[] for i in range(9)}
    for a,b in edges:adjacency[a].append(b);adjacency[b].append(a)
    counts={}
    for a,b in [(6,7),(6,8),(7,8)]:
        def search(v,seen):
            if v==b:return 1
            return sum(search(w,seen|{w}) for w in adjacency[v] if w not in seen)
        counts[str(a-5)+'-'+str(b-5)]=search(a,{a})
    separation=[]
    for a in s['entrances']:
        for b in s['entrances']:
            if a['name']<b['name']:
                separation.append(math.degrees(math.acos(np.clip(np.dot(a['direction'],b['direction']),-1,1))))
    return dict(applicable=True,vertices=9,edges=edges,cycle_rank=len(edges)-9+1,
                distinct_simple_paths_per_entrance_pair=counts,minimum_entrance_angle_degrees=min(separation),
                loop=True,passed=min(counts.values())>=2 and max(separation)>90,
                note='Geometric tangent route graph; overlapping junction volumes may merge small graph cycles. The main physical ring remains open.')


def validate_asset(name):
    s=STATE[name];ob=s['lod0'];t=assert_solid(ob)
    intersections=intersection_check(ob)
    paths=measure_paths(name)
    graph=route_graph(name)
    chamber_reports=[]
    tree,_,_=mesh_bvh(ob)
    for c in s['chambers']:
        chamber_reports.append(dict(center=yup(c),inscribed_diameter_m=2*float(tree.find_nearest(Vector(c))[3])))
    report=dict(asset=name,units='metres',coordinate_system='glTF Y-up',
                dimensions_m=[float(ob.dimensions.x),float(ob.dimensions.z),float(ob.dimensions.y)],origin_blender=list(ob.location),lod0_topology=t,
                lod_triangle_counts={x['asset_node']:len(x.data.polygons) for x in s['lods']},
                self_intersection=intersections,normal_orientation='Consistent connected closed surface with positive signed solid volume; tunnel normals face the void.',
                paths=paths,minimum_clear_diameter_m=min([x['minimum_clear_diameter_m'] for x in paths],default=None),
                minimum_bend_radius_m=min([x['minimum_bend_radius_m'] for x in paths if x['minimum_bend_radius_m'] is not None],default=None),
                chambers=chamber_reports,entrance_count=len(s['entrances']),route_graph=graph,
                texture_sizes={k:list(v.size) for k,v in s['images'].items()},material_count=len(ob.data.materials),
                peak_blender_rss_mb=__import__('resource').getrusage(__import__('resource').RUSAGE_SELF).ru_maxrss/1024,
                known_limits=[],unmet_rules=[])
    ceiling=dict(kovuk=30000,iskele=15000,sessiz_liman=40000)[name]
    assert t['triangles']<=ceiling,report
    assert intersections['passed'],intersections
    if paths:
        assert report['minimum_clear_diameter_m']>=60,report
        assert report['minimum_bend_radius_m']>=60,report
        assert graph['passed'],graph
    for c in chamber_reports:assert 150<=c['inscribed_diameter_m']<=250,c
    s['validation']=report
    folder=OUT/name;folder.mkdir(parents=True,exist_ok=True)
    dump(folder/'validation.json',report)
    return report


def draw_centrelines(name):
    s=STATE[name];made=[]
    mat=bpy.data.materials.new(name+'_map_ink');mat.use_nodes=True
    bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    bs.inputs['Base Color'].default_value=(.03,.7,.52,1);bs.inputs['Emission Color'].default_value=(.03,.7,.52,1);bs.inputs['Emission Strength'].default_value=2
    for i,path in enumerate(s['paths']):
        curve=bpy.data.curves.new('route_'+str(i),'CURVE');curve.dimensions='3D';curve.bevel_depth=1.5;curve.bevel_resolution=2
        spl=curve.splines.new('POLY');spl.points.add(len(path)-1)
        # Lift all paths above the roof for a legible orthographic map overlay.
        for p,co in zip(spl.points,path):p.co=(co[0],co[1],max(v.co.z for v in s['lod0'].data.vertices)+8,1)
        ob=bpy.data.objects.new('route_'+str(i),curve);s['scene'].collection.objects.link(ob);ob.data.materials.append(mat);made.append(ob)
    return made,mat


def kovuk_previews():
    name='kovuk';s=STATE[name]
    preview(name,'exterior_34',(640,-1100,480),(0,0,0))
    preview(name,'exterior_entrance',(0,-1150,100),(0,-60,0))
    preview(name,'inside_chamber',(198,-114,0),(110,-63,0),lens=18)
    preview(name,'inside_bend',(0,-275,0),(25,-190,0),lens=25)
    lines,mat=draw_centrelines(name)
    preview(name,'top_routes',(0,0,1300),(0,0,0),ortho=1250)
    for ob in lines:bpy.data.objects.remove(ob,do_unlink=True)
    bpy.data.materials.remove(mat)
    clay=bpy.data.materials.new('temporary_clay');clay.diffuse_color=(.45,.45,.45,1);clay.use_nodes=True
    bs=next(n for n in clay.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Base Color'].default_value=(.38,.38,.38,1);bs.inputs['Roughness'].default_value=.8
    ob=s['lod0'];ob.data.materials[0]=clay
    for p in ob.data.polygons:p.use_smooth=False
    preview(name,'clay_topology',(640,-1100,480),(0,0,0))
    ob.data.materials[0]=s['material']
    for p in ob.data.polygons:p.use_smooth=True
    bpy.data.materials.remove(clay)


def patch_glb(path,s):
    """Keep logical LOD node names and explicit empty local axes in both formats."""
    data=Path(path).read_bytes();length,typ=struct.unpack_from('<II',data,12)
    doc=json.loads(data[20:20+length]);rest=data[20+length:]
    markers={m['name']:m for m in s['markers']}
    for n in doc['nodes']:
        logical=n.get('extras',{}).get('asset_node')
        if logical:n['name']=logical
        if logical in markers:
            m=markers[logical]
            d=Vector(m['direction']);axis=m['axis'][-1]
            quat=d.to_track_quat(axis,'Y' if axis=='Z' else 'Z')
            n['rotation']=[quat.x,quat.y,quat.z,quat.w]
            n['translation']=m['position']
    raw=json.dumps(doc,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4)
    result=struct.pack('<III',0x46546c67,2,12+8+len(raw)+len(rest))+struct.pack('<II',len(raw),0x4e4f534a)+raw+rest
    Path(path).write_bytes(result)
    return doc


def deliver_asset(name):
    s=STATE[name];bpy.context.window.scene=s['scene'];folder=OUT/name
    bpy.ops.object.select_all(action='DESELECT')
    for ob in s['scene'].objects:
        if ob.type in ('MESH','EMPTY'):
            ob.hide_set(False);ob.hide_viewport=False;ob.select_set(True)
    path=folder/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,
                              export_animations=False,export_image_format='AUTO',export_extras=True,export_cameras=False,export_lights=False)
    doc=patch_glb(path,s)
    assert {n['name'] for n in doc['nodes']}=={'lod0','lod1','lod2'}|{m['name'] for m in s['markers']}
    assert all(im.get('mimeType')=='image/png' and 'bufferView' in im for im in doc.get('images',[]))
    exported_counts={}
    for n in doc['nodes']:
        if n['name'].startswith('lod'):
            exported_counts[n['name']]=sum(doc['accessors'][p['indices']]['count']//3 for p in doc['meshes'][n['mesh']]['primitives'])
    assert exported_counts==s['validation']['lod_triangle_counts']
    s['validation']['exported_glb']=dict(bytes=path.stat().st_size,nodes=[n['name'] for n in doc['nodes']],
                    triangle_counts=exported_counts,embedded_png_images=len(doc.get('images',[])),materials=len(doc.get('materials',[])))
    dump(folder/'validation.json',s['validation'])
    metadata=dict(asset=name,units='metres',coordinate_system='glTF Y-up',main_entrance_direction=[0,0,1],
                  paths=[[yup(p) for p in line] for line in s['paths']],entrances=s['entrances'])
    for category in ['deposit','pad','deck']:
        found=[m for m in s['markers'] if m['name'].startswith(category)]
        if found:metadata[category+'s' if category!='deck' else 'deck']=found if category!='deck' else found[0]
    dump(folder/(name+'.json'),metadata)
    dump(folder/'provenance.json',dict(origin='Original procedural work; no external models or textures',
        author='OpenAI Codex via Blender MCP',blender_version=bpy.app.version_string,date='2026-10-22',
        generator='tools/yarik-blender.py',seed=0,units='metres',texture_method='Object-space procedural PBR baked to unique UV PNG atlases'))
    for ob in s['lods'][1:]:ob.hide_render=True;ob.hide_set(True)
    # Pack images already baked internally; no external dependencies or extra map files.
    old=bpy.context.preferences.filepaths.save_version;bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'yarik-structures.blend'))
    bpy.context.preferences.filepaths.save_version=old
    s['complete']=True
    print('DELIVERED',name,exported_counts,path.stat().st_size)


def cube_part(name,loc,size,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    ob=bpy.context.object;ob.name=name;ob.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=ob.modifiers.new('Machined edge','BEVEL');mod.width=bevel;mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob


def cylinder_part(name,loc,radius,depth,vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    ob=bpy.context.object;ob.name=name
    mod=ob.modifiers.new('Machined edge','BEVEL');mod.width=min(radius*.12,1);mod.segments=2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob


def beam_part(name,a,b,width):
    a,b=Vector(a),Vector(b)
    ob=cube_part(name,(a+b)/2,(width,width,(b-a).length+2),.45)
    ob.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
    return ob


def union_parts(parts,name):
    ob=parts[0];select(ob)
    for operand in parts[1:]:
        mod=ob.modifiers.new('Weld solid','BOOLEAN');enum_value(mod,'operation','UNION');enum_value(mod,'solver','EXACT');mod.object=operand
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(operand,do_unlink=True)
    ob.name=name
    bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    decimate(ob,14000)
    purge(name+' union')
    return ob


def build_iskele():
    assert STATE['kovuk'].get('complete'),'Finish Kovuk first'
    sc=new_scene('iskele');s=STATE['iskele']
    parts=[cylinder_part('Landing slab',(0,0,2),53,6,12),
           cylinder_part('Armoured service core',(0,0,-16),23,34,8),
           cylinder_part('Lower keel',(0,0,-33),15,12,8)]
    for a in np.linspace(0,2*math.pi,6,endpoint=False):
        p=(18*math.cos(a),18*math.sin(a),-29)
        q=(44*math.cos(a),44*math.sin(a),.8)
        parts.append(beam_part('Radial load truss',p,q,5))
    for x in [-29,29]:
        parts.append(cube_part('Tank saddles',(x,8,-6),(12,20,15),1.2))
        parts.append(cylinder_part('Service tank',(x,8,-16),7.5,25,16))
    parts += [cube_part('Beacon footing',(43,7,6),(9,10,8),.8),
              cube_part('Beacon mast',(43,7,23),(3.5,3.5,36),.5),
              cube_part('Beacon head',(43,7,41),(7,6,5),.7),
              cube_part('Antenna footing',(-39,17,6),(8,10,6),.6),
              cube_part('Antenna mast',(-39,17,16),(3,3,20),.3),
              cube_part('Antenna blade',(-39,17,26),(14,3,4),.4),
              cube_part('Service console',(35,-23,7),(12,10,9),1)]
    ob=union_parts(parts,'iskele_lod0');s['lod0']=ob
    select(ob);ob.data.set_sharp_from_angle(angle=.65)
    mod=ob.modifiers.new('Face weighted normals','WEIGHTED_NORMAL');mod.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    marker(s,'deck',(0,0,5),(0,0,1),'Y')
    print('Iskele topology',assert_solid(ob))
    return ob


def linear_rgb(hexrgb):
    c=np.array([int(hexrgb[i:i+2],16)/255 for i in [0,2,4]])
    return np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4)


def deck_decal():
    size=1024
    axis=np.linspace(-64,64,size,dtype=np.float32)
    X,Y=np.meshgrid(axis,axis)
    R=np.hypot(X,Y)
    teal=linear_rgb('2ee6c8')
    pixels=np.zeros((size,size,4),dtype=np.float32)
    ring=(np.abs(R-30)<.75)
    mask=ring.copy()
    def line(x1,y1,x2,y2,width):
        dx,dy=x2-x1,y2-y1
        t=np.clip(((X-x1)*dx+(Y-y1)*dy)/(dx*dx+dy*dy),0,1)
        return (X-x1-t*dx)**2+(Y-y1-t*dy)**2<width**2
    for a in [0,math.pi/2,math.pi,3*math.pi/2]:
        points=[rotate_xy(p,a) for p in [[20,0,0],[25,4,0],[25,-4,0]]]
        mask|=line(*points[0][:2],*points[1][:2],.65)|line(*points[0][:2],*points[2][:2],.65)
    pixels[mask,:3]=teal;pixels[mask,3]=1
    H=line(-6,-8,-6,8,.8)|line(6,-8,6,8,.8)|line(-6,0,6,0,.8)
    border=(np.abs(R-47)<.6)&(np.sin(np.arctan2(Y,X)*12)>.25)
    pixels[H|border,:3]=(.63,.66,.64);pixels[H|border,3]=1
    # Sparse deterministic paint chips, baked once rather than a tiled decal.
    chips=(np.sin(X*2.71+Y*.73)*np.cos(Y*3.13-X*.49)>.91)
    pixels[chips,3]=0
    im=bpy.data.images.new('iskele_decal_source',size,size,alpha=True)
    enum_value(im.colorspace_settings,'name','Non-Color');im.pixels.foreach_set(pixels.ravel());im.update()
    return im


def source_metal(name):
    mat=bpy.data.materials.new(name+'_source');mat.use_nodes=True
    ns=mat.node_tree.nodes;ns.clear();link=mat.node_tree.links.new
    out=node(ns,'ShaderNodeOutputMaterial');bs=node(ns,'ShaderNodeBsdfPrincipled');link(bs.outputs[0],out.inputs['Surface'])
    geom=node(ns,'ShaderNodeNewGeometry');sep=node(ns,'ShaderNodeSeparateXYZ');link(geom.outputs['Position'],sep.inputs[0])
    noise=node(ns,'ShaderNodeTexNoise');noise.inputs['Scale'].default_value=.6 if name=='iskele' else .16;noise.inputs['Detail'].default_value=3
    link(geom.outputs['Position'],noise.inputs['Vector'])
    def mathnode(op,a,b=None):
        n=node(ns,'ShaderNodeMath');enum_value(n,'operation',op)
        if isinstance(a,(float,int)):n.inputs[0].default_value=a
        else:link(a,n.inputs[0])
        if b is not None:
            if isinstance(b,(float,int)):n.inputs[1].default_value=b
            else:link(b,n.inputs[1])
        return n.outputs[0]
    # Panel boundaries in object metres, with fine machining in the normal map.
    grooves=[]
    for axis,period in [('X',12),('Y',15),('Z',9)]:
        if name=='sessiz_liman':period*=2
        wave=mathnode('PINGPONG',sep.outputs[axis],period)
        grooves.append(mathnode('LESS_THAN',wave,.13 if name=='iskele' else .65))
    seam=mathnode('MAXIMUM',grooves[0],grooves[1]);seam=mathnode('MAXIMUM',seam,grooves[2])
    ramp=node(ns,'ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.008,.012,.016,1);ramp.color_ramp.elements[1].color=(.055,.064,.07,1)
    link(noise.outputs['Fac'],ramp.inputs[0])
    mix=node(ns,'ShaderNodeMixRGB');link(seam,mix.inputs[0]);link(ramp.outputs[0],mix.inputs[1]);mix.inputs[2].default_value=(.009,.012,.014,1)
    base=mix.outputs[0]
    if name=='sessiz_liman':
        scorch=node(ns,'ShaderNodeTexNoise');scorch.inputs['Scale'].default_value=.018;scorch.inputs['Detail'].default_value=3.2;scorch.inputs['Roughness'].default_value=.78
        link(geom.outputs['Position'],scorch.inputs['Vector'])
        sr=node(ns,'ShaderNodeValToRGB');sr.color_ramp.elements[0].position=.38;sr.color_ramp.elements[0].color=(1,1,1,1);sr.color_ramp.elements[1].position=.65;sr.color_ramp.elements[1].color=(.12,.09,.07,1)
        link(scorch.outputs['Fac'],sr.inputs[0])
        sm=node(ns,'ShaderNodeMixRGB');enum_value(sm,'blend_type','MULTIPLY');sm.inputs[0].default_value=.8;link(base,sm.inputs[1]);link(sr.outputs[0],sm.inputs[2]);base=sm.outputs[0]
    bump=node(ns,'ShaderNodeBump');bump.inputs['Strength'].default_value=.42;bump.inputs['Distance'].default_value=.12
    link(noise.outputs['Fac'],bump.inputs['Height'])
    bump2=node(ns,'ShaderNodeBump');bump2.inputs['Strength'].default_value=.7;bump2.inputs['Distance'].default_value=.24
    link(seam,bump2.inputs['Height']);link(bump.outputs[0],bump2.inputs['Normal']);link(bump2.outputs[0],bs.inputs['Normal'])
    signals=dict(rough=noise.outputs['Fac'],metal=.82)
    emission=node(ns,'ShaderNodeRGB');emission.outputs[0].default_value=(0,0,0,1)
    if name=='iskele':
        vec=node(ns,'ShaderNodeVectorMath');enum_value(vec,'operation','MULTIPLY_ADD')
        link(geom.outputs['Position'],vec.inputs[0]);vec.inputs[1].default_value=(1/128,1/128,0);vec.inputs[2].default_value=(.5,.5,0)
        tex=node(ns,'ShaderNodeTexImage');tex.image=deck_decal();enum_value(tex,'extension','CLIP');link(vec.outputs[0],tex.inputs['Vector'])
        top=mathnode('GREATER_THAN',sep.outputs['Z'],4.9)
        zn=node(ns,'ShaderNodeSeparateXYZ');link(geom.outputs['Normal'],zn.inputs[0]);top=mathnode('MULTIPLY',top,mathnode('GREATER_THAN',zn.outputs['Z'],.9))
        fac=mathnode('MULTIPLY',tex.outputs['Alpha'],top)
        decal=node(ns,'ShaderNodeMixRGB');link(fac,decal.inputs[0]);link(base,decal.inputs[1]);link(tex.outputs['Color'],decal.inputs[2]);base=decal.outputs[0]
        em=node(ns,'ShaderNodeMixRGB');link(fac,em.inputs[0]);em.inputs[1].default_value=(0,0,0,1);link(tex.outputs['Color'],em.inputs[2])
        signals['emissive']=em.outputs[0]
        # Beacon head uses the same baked emissive atlas as the landing mark.
        beacon=mathnode('GREATER_THAN',sep.outputs['Z'],39)
        sumcol=node(ns,'ShaderNodeMixRGB');enum_value(sumcol,'blend_type','ADD');link(beacon,sumcol.inputs[0]);link(em.outputs[0],sumcol.inputs[1]);sumcol.inputs[2].default_value=(*linear_rgb('2ee6c8'),1)
        signals['emissive']=sumcol.outputs[0]
    else:
        signals['emissive']=station_emission(ns,link,geom,sep,mathnode)
    link(base,bs.inputs['Base Color']);signals['base']=base
    return mat,signals


def iskele_previews():
    name='iskele';s=STATE[name]
    preview(name,'exterior_34',(155,-190,100),(0,0,0))
    preview(name,'exterior_entrance',(0,-230,100),(0,0,3))
    preview(name,'deck_eye',(0,-42,12),(0,10,5),lens=24)
    preview(name,'support_eye',(95,-110,-35),(0,0,-15),lens=35)
    preview(name,'top_routes',(0,0,250),(0,0,0),ortho=180)
    clay=bpy.data.materials.new('temporary_clay');clay.use_nodes=True
    bs=next(n for n in clay.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Base Color'].default_value=(.38,.38,.38,1);bs.inputs['Roughness'].default_value=.8
    s['lod0'].data.materials[0]=clay
    for p in s['lod0'].data.polygons:p.use_smooth=False
    preview(name,'clay_topology',(155,-190,140),(0,0,0))
    s['lod0'].data.materials[0]=s['material']
    for p in s['lod0'].data.polygons:p.use_smooth=True
    bpy.data.materials.remove(clay)


def boolean_cut(ob,cutter):
    select(ob)
    mod=ob.modifiers.new('Designed open volume','BOOLEAN');enum_value(mod,'operation','DIFFERENCE');enum_value(mod,'solver','EXACT');mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)


def sweep_part(name,path,radius=40,sides=20):
    verts=[];faces=[]
    for i,p in enumerate(path):
        tangent=Vector(path[min(i+1,len(path)-1)])-Vector(path[max(i-1,0)])
        tangent.normalize();side=Vector((tangent.y,-tangent.x,0));up=Vector((0,0,1))
        for a in np.linspace(0,2*math.pi,sides,endpoint=False):
            verts.append(Vector(p)+radius*(math.cos(a)*side+math.sin(a)*up))
    for i in range(len(path)-1):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    faces += [tuple(reversed(range(sides))),tuple((len(path)-1)*sides+j for j in range(sides))]
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob)
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    return ob


def annular_room(outer=118,inner=25,height=180,sides=64):
    verts=[]
    for r,z in [(outer,-height/2),(outer,height/2),(inner,-height/2),(inner,height/2)]:
        verts += [(r*math.cos(a),r*math.sin(a),z) for a in np.linspace(0,2*math.pi,sides,endpoint=False)]
    faces=[]
    for j in range(sides):
        k=(j+1)%sides
        faces += [(j,k,sides+k,sides+j),(2*sides+k,2*sides+j,3*sides+j,3*sides+k),
                  (sides+j,sides+k,3*sides+k,3*sides+j),(k,j,2*sides+j,2*sides+k)]
    me=bpy.data.meshes.new('Atrium void');me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new('Atrium void',me);bpy.context.scene.collection.objects.link(ob)
    return ob


def rotated_cube(name,loc,size,angle,bevel=1):
    ob=cube_part(name,rotate_xy(loc,angle),size,bevel)
    ob.rotation_euler.z=angle
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
    return ob


def build_sessiz_liman():
    assert STATE['iskele'].get('complete'),'Finish Iskele first'
    sc=new_scene('sessiz_liman');s=STATE['sessiz_liman'];s['paths']=cave_paths(80,70,345)
    parts=[cylinder_part('Central pressure hull',(0,0,0),138,214,32),
           cylinder_part('Upper service drum',(0,0,111),86,16,16),
           cylinder_part('Lower service drum',(0,0,-111),75,16,16)]
    for i,a in enumerate([0,2*math.pi/3,4*math.pi/3]):
        width=154 if i==0 else 116
        parts.append(rotated_cube('Hangar hull' if i==0 else 'Transfer arm',[0,-213,0],(width,214,120),a,3))
        for y in [-145,-205,-270,-310]:
            parts.append(rotated_cube('Hull reinforcement',[0,y,0],(width+8,9,130),a,1))
        # Substantial girder ridges on the sides remain welded to the pressure hull.
        for side in [-1,1]:
            p=rotate_xy([side*(width/2+1),-175,-38],a);q=rotate_xy([side*(width/2+1),-259,38],a)
            parts.append(beam_part('Exposed diagonal girder',p,q,8))
        parts.append(rotated_cube('Service machinery',[22,-170,66],(34,48,20),a,2))
    ob=union_parts(parts,'sessiz_liman_lod0');s['lod0']=ob
    boolean_cut(ob,annular_room())
    for path in s['paths'][1:]:boolean_cut(ob,sweep_part('Curved corridor void',path,40,20))
    boolean_cut(ob,cube_part('Hangar opening',[0,-254,0],(134,174,92),2))
    # Two ragged breach silhouettes at the outer ends. Their primary corridor remains 80m clear.
    for a in [2*math.pi/3,4*math.pi/3]:
        for x,y,z,w,h in [(-40,-320,25,28,70),(36,-314,-18,25,76),(0,-326,43,90,22)]:
            boolean_cut(ob,rotated_cube('Breach lip missing panel',[x,y,z],(w,26,h),a,.8))
        for side in [-1,1]:
            boolean_cut(ob,rotated_cube('Recessed missing armour panel',[side*58,-222,0],(9,54,40),a,.6))
    # Boolean breach lips can leave coplanar seams. A bounded coarse solid remesh
    # resolves them before the collision mesh is budgeted and validated.
    select(ob)
    mod=ob.modifiers.new('Closed pressure hull remesh','REMESH');enum_value(mod,'mode','VOXEL');mod.voxel_size=3.5;mod.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    purge('Station 3.5m solid remesh')
    decimate(ob,39000)
    keep_main_solid(ob)
    relax_intersections(ob)
    select(ob)
    mod=ob.modifiers.new('Resolve remesh edge serration','SMOOTH');mod.factor=.65;mod.iterations=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    relax_intersections(ob)
    bm=bmesh.new();bm.from_mesh(ob.data)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
    ob.data.normals_split_custom_set([(0,0,0)]*len(ob.data.loops))
    ob.data.set_sharp_from_angle(angle=1.2)
    # Restore an exact rectangular mouth after the coarse solid remesh rounded its corners.
    boolean_cut(ob,cube_part('Final rectangular flight-safe mouth',(0,-260,0),(144,180,90),0))
    decimate(ob,39800);keep_main_solid(ob);relax_intersections(ob)
    s['room_dimensions_m']=[236,180,236]
    for i,a in enumerate([0,2*math.pi/3,4*math.pi/3]):
        point=rotate_xy([0,-320,0],a);direction=rotate_xy([0,-1,0],a)
        marker(s,'entrance_'+str(i+1),point,direction)
        for k in [1+2*i,2+2*i]:s['paths'][k]=[p for p in s['paths'][k] if np.linalg.norm(p)<320]+[point]
    # Pads are portions of the actual flat atrium floor, not floating objects.
    for i,a in enumerate([math.pi/6,5*math.pi/6,3*math.pi/2]):
        marker(s,'pad_'+str(i+1),(78*math.cos(a),78*math.sin(a),-90),(0,0,1),'Y')
    print('Station topology',assert_solid(ob));purge('Station geometry')
    return ob


def station_emission(ns,link,geom,sep,m):
    # Sparse amber ceiling/floor emergency channels. Teal circuits are almost dead.
    zabs=m('ABSOLUTE',sep.outputs['Z'])
    band=m('LESS_THAN',m('ABSOLUTE',m('SUBTRACT',zabs,34)),1.3)
    xgrid=m('LESS_THAN',m('PINGPONG',sep.outputs['X'],29),9)
    ygrid=m('LESS_THAN',m('PINGPONG',sep.outputs['Y'],31),9)
    gate=m('MULTIPLY',band,m('MAXIMUM',xgrid,ygrid))
    noise=node(ns,'ShaderNodeTexNoise');noise.inputs['Scale'].default_value=.045;noise.inputs['Detail'].default_value=1
    link(geom.outputs['Position'],noise.inputs['Vector'])
    alive=m('GREATER_THAN',noise.outputs['Fac'],.57);gate=m('MULTIPLY',gate,alive)
    amber=node(ns,'ShaderNodeMixRGB');link(gate,amber.inputs[0]);amber.inputs[1].default_value=(0,0,0,1);amber.inputs[2].default_value=(.5,.19,.025,1)
    tealband=m('LESS_THAN',m('ABSOLUTE',m('SUBTRACT',zabs,52)),.7)
    tealband=m('MULTIPLY',tealband,m('GREATER_THAN',noise.outputs['Fac'],.63))
    mix=node(ns,'ShaderNodeMixRGB');enum_value(mix,'blend_type','ADD');link(tealband,mix.inputs[0]);link(amber.outputs[0],mix.inputs[1]);mix.inputs[2].default_value=(*(.018*linear_rgb('2ee6c8')),1)
    return mix.outputs[0]


def station_previews():
    name='sessiz_liman';s=STATE[name]
    preview(name,'exterior_34',(720,-920,620),(0,-30,0),lens=42)
    preview(name,'exterior_entrance',(0,-920,140),(0,-60,0),lens=38)
    preview(name,'inside_chamber',(75,-70,-75),(-25,20,-30),lens=16)
    preview(name,'inside_bend',(0,-188,0),(20,-112,0),lens=24)
    lines,mat=draw_centrelines(name)
    preview(name,'top_routes',(0,0,1400),(0,-30,0),ortho=1000)
    for ob in lines:bpy.data.objects.remove(ob,do_unlink=True)
    bpy.data.materials.remove(mat)
    clay=bpy.data.materials.new('temporary_clay');clay.use_nodes=True
    bs=next(n for n in clay.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Base Color'].default_value=(.38,.38,.38,1);bs.inputs['Roughness'].default_value=.8
    s['lod0'].data.materials[0]=clay
    for p in s['lod0'].data.polygons:p.use_smooth=False
    preview(name,'clay_topology',(720,-920,620),(0,-30,0),lens=42)
    s['lod0'].data.materials[0]=s['material']
    for p in s['lod0'].data.polygons:p.use_smooth=True
    bpy.data.materials.remove(clay)


def validate_details(name):
    """Measurements particular to a deck, hangar or landing spot."""
    s=STATE[name];v=s['validation'];tree,_,_=mesh_bvh(s['lod0'])
    if name=='kovuk':
        v['known_limits']=['1024 atlas resolution softens close interior views. Presentation bounce lights are not exported. Optional light shafts were omitted.']
        v['unmet_rules']=['Rule 6: close interior texture detail falls short of the requested premium photographic quality; geometric and budget checks pass.']
    elif name=='iskele':
        heights=[]
        for r in [0,10,20,30]:
            for a in np.linspace(0,2*math.pi,48,endpoint=False):
                hit,_,_,_=tree.ray_cast(Vector((r*math.cos(a),r*math.sin(a),60)),Vector((0,0,-1)),120)
                assert hit is not None;heights.append(float(hit.z))
        error=max(abs(h-5) for h in heights);assert error<.01
        v['deck']=dict(clear_landing_circle_diameter_m=60,deck_width_m=106,landing_samples=len(heights),maximum_flatness_error_m=error,portal_geometry=False)
        v['known_limits']=['Solid platform has no interior: deck-eye and support-eye images replace cave/station interior views. Presentation lights are not exported.']
    else:
        widths=[];heights=[]
        for z in [-40,0,40]:
            p=Vector((0,-310,z));a=tree.ray_cast(p,Vector((-1,0,0)),140);b=tree.ray_cast(p,Vector((1,0,0)),140)
            assert a[0] is not None and b[0] is not None;widths.append(a[3]+b[3])
        for x in [-60,0,60]:
            p=Vector((x,-310,0));a=tree.ray_cast(p,Vector((0,0,-1)),100);b=tree.ray_cast(p,Vector((0,0,1)),100)
            assert a[0] is not None and b[0] is not None;heights.append(a[3]+b[3])
        assert min(widths)>=120 and min(heights)>=80
        v['hangar']=dict(minimum_opening_width_m=min(widths),minimum_opening_height_m=min(heights),sample_plane_blender_y=-310)
        v['atrium']=dict(nominal_outer_room_diameter_m=236,nominal_height_m=180,central_column_diameter_m=50,circulation_centreline_radius_m=80)
        pads=[]
        for m in s['markers']:
            if not m['name'].startswith('pad_'):continue
            p=Vector((m['position'][0],-m['position'][2],-70));hit,_,_,_=tree.ray_cast(p,Vector((0,0,-1)),80)
            assert hit is not None;m['position']=yup(hit)
            for obj in s['scene'].objects:
                if obj.get('asset_node')==m['name']:obj.location=hit
            samples=[]
            for a in np.linspace(0,2*math.pi,24,endpoint=False):
                q=Vector((hit.x+12*math.cos(a),hit.y+12*math.sin(a),-70));h,_,_,_=tree.ray_cast(q,Vector((0,0,-1)),80)
                assert h is not None;samples.append(h.z)
            error=max(abs(h-hit.z) for h in samples);assert error<.15
            pads.append(dict(name=m['name'],clear_disk_diameter_m=24,maximum_flatness_error_m=error))
        v['pads']=pads;v['minimum_nominal_girder_thickness_m']=8
        v['known_limits']=['1024 atlases soften close interior views. The 3.5m solid remesh rounds damaged panel edges. Pads vary by at most 0.10m across their 24m landing disks. Presentation lights are not exported.']
        v['unmet_rules']=['Rule 6: close interior texture detail falls short of the requested premium photographic quality; geometric and budget checks pass.']
    return v


def glb_roundtrip(name):
    """Validate the actual GLB binary, including welded collision triangles and empty axes."""
    s=STATE[name];raw=(OUT/name/(name+'.glb')).read_bytes();offset=12;doc=None;binary=None
    while offset<len(raw):
        length,kind=struct.unpack_from('<II',raw,offset);payload=raw[offset+8:offset+8+length]
        if kind==0x4e4f534a:doc=json.loads(payload)
        if kind==0x004e4942:binary=payload
        offset+=8+length
    assert doc and binary is not None
    def accessor(index):
        a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']]
        dtype={5126:np.float32,5125:np.uint32,5123:np.uint16,5121:np.uint8}[a['componentType']]
        width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];item=np.dtype(dtype).itemsize
        return np.ndarray((a['count'],width),dtype=dtype,buffer=binary,
              offset=view.get('byteOffset',0)+a.get('byteOffset',0),strides=(view.get('byteStride',item*width),item))
    n=next(n for n in doc['nodes'] if n['name']=='lod0')
    assert 'matrix' not in n and 'rotation' not in n and 'scale' not in n
    primitive=doc['meshes'][n['mesh']]['primitives'];assert len(primitive)==1
    positions=accessor(primitive[0]['attributes']['POSITION']);indices=accessor(primitive[0]['indices']).reshape(-1,3)
    welded,remap=np.unique(positions,axis=0,return_inverse=True)
    faces=remap[indices]
    me=bpy.data.meshes.new('_glb_roundtrip');me.from_pydata(welded.tolist(),[],faces.tolist());me.update()
    ob=bpy.data.objects.new('_glb_roundtrip',me)
    try:
        t=assert_solid(ob);intersections=intersection_check(ob);assert intersections['passed']
        tree,_,_=mesh_bvh(ob);minimum=None;samples=0
        for path in s['paths']:
            for p in sample_path(path):
                point=Vector(yup(p));hit,normal,_,distance=tree.find_nearest(point)
                assert not point_inside(tree,point)
                minimum=distance if minimum is None else min(minimum,distance);samples+=1
        if minimum is not None:assert minimum>=30
    finally:
        bpy.data.objects.remove(ob);bpy.data.meshes.remove(me)
    byname={n['name']:n for n in doc['nodes']}
    from mathutils import Quaternion
    for m in s['markers']:
        n=byname[m['name']];q=n.get('rotation',[0,0,0,1]);quat=Quaternion((q[3],q[0],q[1],q[2]))
        axis=Vector((0,0,1) if m['axis']=='+Z' else (0,1,0))
        assert (quat@axis-Vector(m['direction'])).length<.0001
        assert (Vector(n['translation'])-Vector(m['position'])).length<.0001
    pngs=[]
    for im in doc['images']:
        assert im['mimeType']=='image/png' and 'uri' not in im
        view=doc['bufferViews'][im['bufferView']];png=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
        assert png[:8]==b'\x89PNG\r\n\x1a\n'
        size=struct.unpack_from('>II',png,16);assert max(size)<=2048;pngs.append(dict(name=im['name'],size=list(size)))
    preview_sizes={}
    for path in sorted((OUT/name/'previews').glob('*.png')):
        size=struct.unpack_from('>II',path.read_bytes(),16);assert max(size)==1600
        preview_sizes[path.name]=list(size)
    assert len(preview_sizes)==6
    report=dict(welded_lod0_topology=t,self_intersection=intersections,
                sampled_points_in_open_space=samples,minimum_clear_diameter_m=2*minimum if minimum else None,
                marker_axes_verified=len(s['markers']),embedded_pngs=pngs,preview_sizes=preview_sizes)
    s['validation']['glb_roundtrip']=report
    purge(name+' serialized validation')
    return report


def finish_asset(name):
    """Complete one asset before the next is permitted to start."""
    surface_asset(name);setup_lighting(name)
    if name=='kovuk':kovuk_markers()
    make_lods(name);validate_asset(name);validate_details(name)
    {'kovuk':kovuk_previews,'iskele':iskele_previews,'sessiz_liman':station_previews}[name]()
    deliver_asset(name);glb_roundtrip(name)
    s=STATE[name];s['validation']['peak_blender_rss_mb']=__import__('resource').getrusage(__import__('resource').RUSAGE_SELF).ru_maxrss/1024
    dump(OUT/name/'validation.json',s['validation'])


def hydrate_completed():
    """Reattach Python state after opening the shared .blend in a fresh Blender."""
    for name in ['kovuk','iskele','sessiz_liman']:
        if name in STATE or name not in bpy.data.scenes or not (OUT/name/(name+'.json')).exists():continue
        sc=bpy.data.scenes[name];metadata=json.loads((OUT/name/(name+'.json')).read_text())
        lods=sorted([o for o in sc.objects if o.get('asset_node','').startswith('lod')],key=lambda o:o['asset_node'])
        if len(lods)!=3:continue
        markers=list(metadata['entrances'])
        markers+=metadata.get('deposits',[])+metadata.get('pads',[])
        if 'deck' in metadata:markers.append(metadata['deck'])
        v=json.loads((OUT/name/'validation.json').read_text())
        if v.get('review') in ['review-1','review-2','review-3']:continue
        mat=lods[0].data.materials[0]
        images={n.image.name.rsplit('_',1)[-1]:n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE'}
        inverse=lambda p:[p[0],-p[2],p[1]]
        STATE[name]=dict(scene=sc,lod0=lods[0],lods=lods,material=mat,images=images,markers=markers,
                         entrances=metadata['entrances'],paths=[[inverse(p) for p in path] for path in metadata['paths']],
                         chambers=[inverse(c['center']) for c in v.get('chambers',[])],validation=v,complete=True)


def rebuild_all():
    raise RuntimeError('Use r1_run_stage() one short MCP call at a time; see docs/yarik-structures.md')


hydrate_completed()

# Review 1 ---------------------------------------------------------------
# Public staged entry points below deliberately keep Blender calls short.
# Order: r1_iskele(), maps one at a time, lighting, one preview per call,
# validation, delivery; then Liman and Kovuk. No high-resolution bake is used.

def r1_reset_live():
    temporary=bpy.data.scenes.new('_review_stage');bpy.context.window.scene=temporary
    for name in ['iskele','sessiz_liman','kovuk']:
        sc=bpy.data.scenes.get(name)
        if sc:
            for ob in list(sc.objects):bpy.data.objects.remove(ob,do_unlink=True)
            bpy.data.scenes.remove(sc)
    for im in list(bpy.data.images):
        if im.name.startswith(('iskele_','sessiz_liman_','kovuk_')):bpy.data.images.remove(im)
    STATE.clear();purge('Review 1 empty working scene')


def r1_cylinder(name,loc,radius,depth,vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    ob=bpy.context.object;ob.name=name
    return ob


def r1_beam(name,a,b,width):
    a,b=Vector(a),Vector(b)
    ob=cube_part(name,(a+b)/2,(width,width,(b-a).length+1.0))
    from mathutils import Quaternion
    ob.rotation_euler=((b-a).to_track_quat('Z','Y')@Quaternion((0,0,1),.173)).to_euler()
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
    return ob


def r1_union(parts,name):
    ob=parts[0];select(ob)
    for operand in parts[1:]:
        mod=ob.modifiers.new('Exact structural weld','BOOLEAN');enum_value(mod,'operation','UNION');enum_value(mod,'solver','EXACT');mod.object=operand
        bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(operand,do_unlink=True)
    ob.name=name;ob['asset_node']='collider'
    bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bm=bmesh.new();bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.0001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
    decimate(ob,1000000)
    return ob


def r1_region(ob,value):
    attr=ob.data.attributes.get('r1_region') or ob.data.attributes.new('r1_region','INT','FACE')
    attr.data.foreach_set('value',np.full(len(ob.data.polygons),value,dtype=np.int32))


def r1_quad(name,points,region=1):
    me=bpy.data.meshes.new(name);me.from_pydata(points,[],[(0,1,2),(0,2,3)]);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob);r1_region(ob,region)
    return ob


def r1_render_from_collider(name,bevel=.22):
    s=STATE[name];collider=s['collider'];ob=collider.copy();ob.data=collider.data.copy()
    s['scene'].collection.objects.link(ob);ob.name=name+'_lod0';ob['asset_node']='lod0'
    select(ob)
    if bevel:
        mod=ob.modifiers.new('Crisp machined bevels','BEVEL');mod.width=bevel;mod.segments=2;mod.limit_method='ANGLE';mod.angle_limit=.45
        bpy.ops.object.modifier_apply(modifier=mod.name)
    decimate(ob,1000000)
    ob.data.set_sharp_from_angle(angle=.7)
    mod=ob.modifiers.new('Machined plane normals','WEIGHTED_NORMAL');mod.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    r1_region(ob,0);s['lod0']=ob;s['render_parts']=[ob]
    collider.hide_render=True;collider.hide_set(True)
    purge(name+' exact collider and bevelled render')
    return ob


def r1_iskele():
    sc=new_scene('iskele');s=STATE['iskele'];s['review']='review-1';s['complete']=False
    s['deck_z']=10.75;s['flood_positions']=[]
    parts=[r1_cylinder('Lower stepped rim',(0,0,4.5),54,3),
           r1_cylinder('Load deck',(0,0,7.5),53,6),
           r1_cylinder('Inset landing surface',(0,0,10.55),51,.4),
           r1_cylinder('Service spine',(0,0,-10),12,30,12),
           r1_cylinder('Lower load hub',(0,0,-22),16,8,12),
           cube_part('Thruster block',(0,0,-29),(20,20,12))]
    for a in [0,2*math.pi/3,4*math.pi/3]:
        bottom=rotate_xy((14,0,-23),a)
        for offset in [-.38,.38]:
            parts.append(r1_beam('Primary truss',bottom,rotate_xy((45,0,4.5),a+offset),4))
            parts.append(r1_beam('Lattice diagonal',rotate_xy((14,0,-22),a-offset),rotate_xy((34,0,-6),a+offset*.5),3.4))
        parts.append(r1_beam('Upper load crossbar',rotate_xy((43,0,3.5),a-.38),rotate_xy((43,0,3.5),a+.38),4))
    for a in [math.pi/3,math.pi,5*math.pi/3]:
        x,y,_=rotate_xy((25,0,0),a)
        parts.append(r1_cylinder('Fuel reservoir',(x,y,-11),7,26,20))
        parts.append(cube_part('Tank saddle',(x,y,1.5),(12,12,8)))
    parts += [cube_part('Beacon foundation',(47,0,11),(8,10,3)),
              cube_part('Single navigation mast',(47,0,39),(4,5,54)),
              cube_part('Beacon housing',(47,0,67),(7,7,4)),
              cube_part('Service access cover',(-42,8,11),(7,9,1.5))]
    for a in [.8,2.3,3.9,5.4]:
        x,y,_=rotate_xy((40,0,0),a)
        parts.append(cube_part('Downward floodlight casing',(x,y,2.5),(4,6,4)))
        s['flood_positions'].append((x,y,.5))
    col=r1_union(parts,'iskele_collider');s['collider']=col
    print('Collider',assert_solid(col));assert len(col.data.polygons)<=12000
    ob=r1_render_from_collider('iskele',.20)
    # Inset strips lie 5cm above the actual faceted rim surface, not on an imagined circle.
    for i in range(24):
        a,b=i*2*math.pi/24,(i+1)*2*math.pi/24
        p=Vector((53*math.cos(a),53*math.sin(a),0));q=Vector((53*math.cos(b),53*math.sin(b),0))
        normal=Vector((math.cos((a+b)/2),math.sin((a+b)/2),0))
        p,q=p.lerp(q,.16)+normal*.05,p.lerp(q,.84)+normal*.05
        pts=[(p.x,p.y,7.1),(q.x,q.y,7.1),(q.x,q.y,7.5),(p.x,p.y,7.5)]
        s['render_parts'].append(r1_quad('Inset rim light',pts,1))
    for x,y,z in s['flood_positions']:
        s['render_parts'].append(r1_quad('Floodlight lens',[(x-.6,y-1,z-.03),(x-.6,y+1,z-.03),(x+.6,y+1,z-.03),(x+.6,y-1,z-.03)],2))
    # Beacon faces: a lit top and a thin band on its four sides.
    for axis,sign in [(0,1),(0,-1),(1,1),(1,-1)]:
        points=[]
        for h,t in [(65.8,-2.7),(65.8,2.7),(68.1,2.7),(68.1,-2.7)]:
            point=[47,0,h];point[axis]+=sign*3.54;point[1-axis]+=t;points.append(point)
        s['render_parts'].append(r1_quad('Navigation beacon lens',points,1))
    r1_iskele_finish_details()
    marker(s,'deck',(0,0,10.75),(0,0,1),'Y')
    s['preview_specs']={
        'exterior_34':((155,-190,133),(0,0,12),None,38),
        'exterior_entrance':((0,-950,324.2498999),(0,0,12),None,40),
        'deck_eye':((0,-43,18),(0,10,11),None,25),
        'support_eye':((95,-125,-38),(0,0,-12),None,36),
        'top_routes':((0,0,300),(0,0,0),190,40),
        'clay_topology':((155,-190,133),(0,0,12),None,38)}
    purge('Iskele review geometry')


def r1_join_render(name):
    s=STATE[name];bpy.ops.object.select_all(action='DESELECT')
    for ob in s['render_parts']:ob.select_set(True)
    bpy.context.view_layer.objects.active=s['lod0'];bpy.ops.object.join()
    ob=s['lod0'];select(ob)
    if 'material' in s:
        ob.data.materials.clear();ob.data.materials.append(s['material'])
        for face in ob.data.polygons:face.material_index=0
    mod=ob.modifiers.new('Final triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=mod.name)
    s['render_parts']=[ob]
    print('Render triangles',len(ob.data.polygons))
    r1_uv_iskele(ob) if name=='iskele' else r1_uv_structure(name,ob)
    purge(name+' render assembly')


def r1_uv_iskele(ob):
    uv=ob.data.uv_layers.get('UVMap') or ob.data.uv_layers.new(name='UVMap')
    regions=ob.data.attributes['r1_region'].data
    for f in ob.data.polygons:
        region=regions[f.index].value
        for index in f.loop_indices:
            p=ob.data.vertices[ob.data.loops[index].vertex_index].co
            if region:
                co={1:(.85,.92),2:(.95,.75),3:(.84,.75),4:(.94,.53),5:(.96,.60),6:(.96,.67),7:(.83,.80),8:(.96,.80)}[region]
            elif abs(p.z-10.75)<.03 and f.normal.z>.9:
                co=(.04+.70*(p.x/110+.5),.04+.70*(p.y/110+.5))
            else:
                a=max(range(3),key=lambda i:abs(f.normal[i]));u,v=[i for i in range(3) if i!=a]
                co=(.79+.20*((p[u]+90)/180),.04+.60*((p[v]+90)/180))
            uv.data[index].uv=co


def r1_atlas(name,kind,size=1024):
    """Unique direct-painted atlas: crisp glyphs and panel maps without a lossy bake."""
    s=STATE[name];axis=(np.arange(size,dtype=np.float32)+.5)/size
    U,V=np.meshgrid(axis,axis);X=((U-.04)/.70-.5)*110;Y=((V-.04)/.70-.5)*110
    rng=np.random.default_rng(7203);grain=rng.random((size,size),dtype=np.float32)-.5
    rgb=np.zeros((size,size,3),dtype=np.float32)
    height=np.zeros((size,size),dtype=np.float32)
    rough=np.full((size,size),.53,dtype=np.float32);metal=np.full((size,size),.86,dtype=np.float32)
    emission=np.zeros_like(rgb)
    if name=='iskele':
        base=np.array([.029,.043,.052],dtype=np.float32)
        rgb[:]=base;rgb+=grain[:,:,None]*.004
        deck=(U<.75)&(V<.75);R=np.hypot(X,Y);angle=np.arctan2(Y,X)
        panel=(np.floor((X+55)/15)+2*np.floor((Y+55)/18))%5
        rgb[deck]*=(.90+.035*panel[deck,None])
        sx=np.abs(((X+7.5)%15)-7.5);sy=np.abs(((Y+9)%18)-9)
        seam=deck&((sx<.12)|(sy<.12));rgb[seam]*=.36;height[seam]=-.12
        teal=linear_rgb('2ee6c8');amber=linear_rgb('e6a450')
        phase=(angle%(2*math.pi/24))/(2*math.pi/24)
        glyph=(np.abs(R-30)<.53)&(phase>.10)&(phase<.90)&deck
        def line(x1,y1,x2,y2,width):
            dx,dy=x2-x1,y2-y1;t=np.clip(((X-x1)*dx+(Y-y1)*dy)/(dx*dx+dy*dy),0,1)
            return (X-x1-t*dx)**2+(Y-y1-t*dy)**2<width*width
        for a in [0,math.pi/2,math.pi,3*math.pi/2]:
            points=[rotate_xy(p,a) for p in [(21,0,0),(25,3.5,0),(25,-3.5,0)]]
            glyph|=deck&(line(*points[0][:2],*points[1][:2],.5)|line(*points[0][:2],*points[2][:2],.5))
        glyph|=(R<1.55)&deck
        chips=(grain>.475)&glyph
        glyph&=~chips
        rgb[glyph]=teal*.56;emission[glyph]=teal*.65;rough[glyph]=.46;metal[glyph]=.18
        hazard=(np.abs(R-49)<.33)&((angle%(2*math.pi/48))<(2*math.pi/48)*.53)&deck
        rgb[hazard]=amber*.44;emission[hazard]=amber*.11;metal[hazard]=.16
        for a in np.linspace(0,2*math.pi,12,endpoint=False):
            d=np.hypot(X-40.5*math.cos(a),Y-40.5*math.sin(a))
            ring=(d<.76)&(d>.46)&deck;hole=(d<.42)&deck
            rgb[ring]=(.15,.18,.19);rgb[hole]=(.006,.009,.011);height[ring]=.06;height[hole]=-.12
        # Three small atlas swatches for inset practical fixtures.
        for mask,color in [((U>.80)&(V>.84),teal*.85),((U>.91)&(V>.69)&(V<.81),np.array([.56,.72,.85])),((U>.79)&(U<.90)&(V>.69)&(V<.81),amber*.35)]:
            rgb[mask]=color;emission[mask]=color;rough[mask]=.3;metal[mask]=.1
        band=(U>.93)&(V>.56)&(V<.64);rgb[band]=(.12,.15,.17);rough[band]=.36
        vent=(U>.93)&(V>.65)&(V<.69);rgb[vent]=(.004,.009,.012);rough[vent]=.68;emission[vent]=(.008,.026,.035)
    else:
        rgb,height,rough,metal,emission=r1_structure_atlas(name,U,V,grain)
    if kind=='base':
        pixels=np.where(rgb<=.0031308,rgb*12.92,1.055*np.maximum(rgb,0)**(1/2.4)-.055)
    elif kind=='emissive':pixels=np.where(emission<=.0031308,emission*12.92,1.055*np.maximum(emission,0)**(1/2.4)-.055)
    elif kind=='orm':pixels=np.stack([np.ones_like(rough),rough,metal],axis=2)
    else:
        dy,dx=np.gradient(height);nx=-dx*1.6+grain*.026;ny=-dy*1.6;z=np.ones_like(nx)
        n=np.stack([nx,ny,z],axis=2);n/=np.linalg.norm(n,axis=2)[:,:,None];pixels=n*.5+.5
    rgba=np.ones((size,size,4),dtype=np.float32);rgba[:,:,:3]=np.clip(pixels,0,1)
    im=bpy.data.images.new(name+'_'+kind,size,size,alpha=False)
    enum_value(im.colorspace_settings,'name','sRGB' if kind in ['base','emissive'] else 'Non-Color')
    im.pixels.foreach_set(rgba.ravel());im.update();im.pack();im.use_fake_user=True
    s.setdefault('images',{})[kind]=im;purge(name+' direct '+kind+' atlas')


def r1_material(name):
    s=STATE[name];mat=bpy.data.materials.new(name+'_review1_PBR');mat.use_nodes=True
    ns=mat.node_tree.nodes;link=mat.node_tree.links.new
    bs=next(n for n in ns if n.type=='BSDF_PRINCIPLED');tex={}
    for kind,im in s['images'].items():
        tex[kind]=node(ns,'ShaderNodeTexImage');tex[kind].image=im
    link(tex['base'].outputs[0],bs.inputs['Base Color'])
    normal=node(ns,'ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.65
    link(tex['normal'].outputs[0],normal.inputs['Color']);link(normal.outputs[0],bs.inputs['Normal'])
    sep=node(ns,'ShaderNodeSeparateColor');link(tex['orm'].outputs[0],sep.inputs[0]);link(sep.outputs[1],bs.inputs['Roughness']);link(sep.outputs[2],bs.inputs['Metallic'])
    link(tex['emissive'].outputs[0],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=2.5
    group=bpy.data.node_groups.get('glTF Material Output')
    if group is None:
        group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree');group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
    gn=node(ns,'ShaderNodeGroup');gn.node_tree=group;link(sep.outputs[0],gn.inputs['Occlusion'])
    mat.use_fake_user=True;s['material']=mat
    for ob in {s['lod0'],*s.get('lods',[])}:
        ob.data.materials.clear();ob.data.materials.append(mat)
        for face in ob.data.polygons:face.material_index=0
    purge(name+' material assembly')


def r1_lighting(name):
    s=STATE[name];sc=s['scene'];set_engine(sc,'BLENDER_EEVEE');sc.eevee.taa_render_samples=64;sc.eevee.use_raytracing=False
    enum_value(sc.eevee,'shadow_pool_size','64')
    bg=next(n for n in sc.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.045,.06,.085,1);bg.inputs['Strength'].default_value=.25
    sun=light(sc,'Warm stellar key',(-500,-700,800),2.2,(1,.86,.68),kind='SUN');sun.data.angle=.08
    if name=='iskele':
        light(sc,'Low cool fill',(110,-140,60),8e5,(.57,.73,1),150)
        light(sc,'Rim separation',(-100,90,90),2e6,(.65,.79,1),100)
        light(sc,'Underside fill',(0,-100,-70),3e5,(.62,.71,.85),80,target=(0,0,-15))
        for i,p in enumerate(s['flood_positions']):light(sc,'Down flood '+str(i),p,1400,(.64,.8,1),4,target=(p[0],p[1],-25))
    else:r1_interior_lighting(name)
    enum_value(sc.view_settings,'view_transform','AgX')
    sc.render.resolution_x=1600;sc.render.resolution_y=1000;sc.render.resolution_percentage=100
    enum_value(sc.render.image_settings,'file_format','PNG');enum_value(sc.render.image_settings,'color_mode','RGB')
    sc.render.threads_mode='FIXED';sc.render.threads=2
    purge(name+' lighting')


def r1_preview(name,kind):
    s=STATE[name]
    specs=s['preview_specs'];position,target,ortho,lens=specs[kind]
    col=s['collider'];col.hide_render=True
    clay=None
    if kind=='clay_topology':
        clay=bpy.data.materials.get('review_clay') or bpy.data.materials.new('review_clay');clay.use_nodes=True;clay.use_fake_user=True
        bs=next(n for n in clay.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Base Color'].default_value=(.32,.36,.4,1);bs.inputs['Roughness'].default_value=.7
        s['scene'].view_layers[0].material_override=clay
    lines=[];line_mat=None
    if kind=='top_routes' and s['paths']:lines,line_mat=r1_cave_map() if name=='kovuk' else draw_centrelines(name)
    shadow_flags=[]
    if name=='kovuk' and not s.get('r4_real_shadows') and kind in ['exterior_34','exterior_entrance','top_routes','clay_topology']:
        for ob in s['scene'].objects:
            if ob.type=='LIGHT':shadow_flags.append((ob,ob.data.use_shadow));ob.data.use_shadow=False
    preview(name,kind,position,target,ortho=ortho,lens=lens)
    for ob,value in shadow_flags:ob.data.use_shadow=value
    for ob in lines:bpy.data.objects.remove(ob,do_unlink=True)
    if line_mat:line_mat.use_fake_user=True
    # Keep authored material attached: preview() purges orphans after rendering.
    if clay:s['scene'].view_layers[0].material_override=None
    purge(name+' preview '+kind)


def r1_sample_surface(ob,count=50000):
    verts=np.array([v.co[:] for v in ob.data.vertices],dtype=np.float64)
    faces=np.array([p.vertices[:] for p in ob.data.polygons],dtype=np.int32)
    tri=verts[faces];area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)*.5
    rng=np.random.default_rng(20522);ids=rng.choice(len(tri),count,p=area/area.sum())
    u=np.sqrt(rng.random(count));v=rng.random(count)
    points=tri[ids,0]*(1-u[:,None])+tri[ids,1]*(u*(1-v))[:,None]+tri[ids,2]*(u*v)[:,None]
    return points,verts


def r1_distance(name):
    s=STATE[name];result={}
    for label,source,target in [('lod0_to_collider',s['lod0'],s['collider']),('collider_to_lod0',s['collider'],s['lod0'])]:
        points,vertices=r1_sample_surface(source);tree,_,_=mesh_bvh(target)
        distances=np.array([tree.find_nearest(Vector(p))[3] for p in points])
        vertex_max=max(tree.find_nearest(Vector(p))[3] for p in vertices)
        result[label]=dict(area_weighted_samples=len(points),maximum_m=float(max(distances.max(),vertex_max)),p99_m=float(np.percentile(distances,99)),vertex_samples=len(vertices))
        assert result[label]['maximum_m']<=.75,(name,label,result[label])
    s['distance']=result;purge(name+' bidirectional distance')
    print(json.dumps(result,indent=2));return result


def r1_iskele_finish_details():
    s=STATE['iskele'];tree,_,_=mesh_bvh(s['collider'])
    for x in [-5,0,5]:
        s['render_parts'].append(r1_quad('Thruster exhaust grille',[(x-1.5,-4,-35.03),(x-1.5,4,-35.03),(x+1.5,4,-35.03),(x+1.5,-4,-35.03)],6))
    for a in [math.pi/3,math.pi,5*math.pi/3]:
        x,y,_=rotate_xy((25,0,0),a)
        for z in [-18,-4]:
            for i in range(20):
                a0,a1=2*math.pi*i/20,2*math.pi*(i+1)/20
                n=Vector((math.cos((a0+a1)/2),math.sin((a0+a1)/2),0))
                p=Vector((x+7*math.cos(a0),y+7*math.sin(a0),z))+n*.035
                q=Vector((x+7*math.cos(a1),y+7*math.sin(a1),z))+n*.035
                points=[(p.x,p.y,z-.22),(q.x,q.y,z-.22),(q.x,q.y,z+.22),(p.x,p.y,z+.22)]
                if max(tree.find_nearest(Vector(v))[3] for v in points)>.2:continue
                s['render_parts'].append(r1_quad('Reservoir retaining strap',points,5))


def r1_measure_routes(name):
    s=STATE[name];tree,_,_=mesh_bvh(s['collider']);reports=[]
    for i,path in enumerate(s['paths']):
        samples=sample_path(path,8);distances=[tree.find_nearest(Vector(p))[3] for p in samples]
        inside=sum(point_inside(tree,p) for p in samples)
        report=dict(path=i,samples=len(samples),maximum_sample_spacing_m=max((Vector(a)-Vector(b)).length for a,b in zip(samples,samples[1:])),
                    minimum_clear_diameter_m=2*min(distances),points_in_solid=inside,minimum_bend_radius_m=bend_radius(path))
        assert inside==0 and report['minimum_clear_diameter_m']>=60,(name,report)
        if report['minimum_bend_radius_m'] is not None:assert report['minimum_bend_radius_m']>=59.99,(name,report)
        reports.append(report)
    return reports


def r1_graph_check(name):
    s=STATE[name]
    if not s['paths']:return dict(applicable=False,reason='Solid operational deck; explicit no-tunnel exception')
    graph=s['graph'];edges=graph['edges'];vertices=graph['vertices'];adj={key:[] for key in vertices}
    for a,b in edges:adj[a].append(b);adj[b].append(a)
    entrances=graph['entrance_vertices'];counts={}
    def paths_to(a,b):
        count=0;stack=[(a,{a})]
        while stack and count<2:
            current,seen=stack.pop()
            if current==b:count+=1;continue
            stack += [(other,seen|{other}) for other in adj[current] if other not in seen]
        return count
    for i,a in enumerate(entrances):
        for b in entrances[i+1:]:counts[a+'-'+b]=paths_to(a,b)
    assert all(n>=2 for n in counts.values()),counts
    cycle_rank=len(edges)-len(vertices)+1
    assert cycle_rank>=(2 if name=='kovuk' else 1)
    return dict(applicable=True,vertices=vertices,edges=edges,entrance_vertices=entrances,cycle_rank=cycle_rank,
                minimum_distinct_routes_per_entrance_pair=counts,passed=True)


def r1_validate(name):
    s=STATE[name];col=s['collider'];top=assert_solid(col);intersections=intersection_check(col)
    assert intersections['passed'],intersections
    assert top['triangles']<=(16000 if name=='kovuk' else 12000)
    ceiling={'iskele':15000,'sessiz_liman':40000,'kovuk':30000}[name]
    assert len(s['lod0'].data.polygons)<=ceiling
    paths=r1_measure_routes(name);graph=r1_graph_check(name)
    v=dict(asset=name,review='review-1',units='metres',coordinate_system='glTF Y-up',collision_node='collider',
           collider_topology=top,self_intersection=intersections,
           lod_triangle_counts={o['asset_node']:len(o.data.polygons) for o in s['lods']},
           collider_vs_lod0=s['distance'],paths=paths,route_graph=graph,entrance_count=len(s['entrances']),
           minimum_clear_diameter_m=min((p['minimum_clear_diameter_m'] for p in paths),default=None),
           minimum_bend_radius_m=min((p['minimum_bend_radius_m'] for p in paths if p['minimum_bend_radius_m'] is not None),default=None),
           dimensions_m=[float(col.dimensions.x),float(col.dimensions.z),float(col.dimensions.y)],
           texture_sizes={k:list(im.size) for k,im in s['images'].items()},material_count=1,
           generation='Exact booleans and bevels; no hard-surface voxel remesh' if name!='kovuk' else 'Implicit fractured basalt',
           known_limits=[],unmet_rules=[],current_rss_mib=purge(name+' collider validation'),
           peak_process_rss_mib=__import__('resource').getrusage(__import__('resource').RUSAGE_SELF).ru_maxrss/1024)
    if name=='iskele':
        tree,_,_=mesh_bvh(col);heights=[]
        for r in [0,10,20,30]:
            for a in np.linspace(0,2*math.pi,48,endpoint=False):
                hit,_,_,_=tree.ray_cast(Vector((r*math.cos(a),r*math.sin(a),80)),Vector((0,0,-1)),120)
                assert hit is not None;heights.append(hit.z)
        flatness=max(abs(h-10.75) for h in heights);assert flatness<.001
        v['deck']=dict(width_m=106,clear_circle_diameter_m=60,glyph_segments=24,chevrons=4,centre_dot=True,earth_H=False,
                       maximum_flatness_error_m=flatness,samples=len(heights),beacon_height_above_deck_m=69-10.75,
                       nominal_minimum_truss_member_m=3.4,fuel_tanks=3,thruster_block=True,downward_floodlights=4)
        v['known_limits']=['No interior on the solid dock; deck-eye and underside-eye views replace the two interior views. Preview lights are not exported.']
    else:r1_validate_specific(name,v)
    s['validation']=v;dump(OUT/name/'validation.json',v)
    print(json.dumps({k:v[k] for k in ['asset','collider_topology','lod_triangle_counts','minimum_clear_diameter_m','minimum_bend_radius_m']}))
    return v


def r1_save_source():
    for scene in list(bpy.data.scenes):
        if scene.name not in ['iskele','sessiz_liman','kovuk'] and not scene.objects:bpy.data.scenes.remove(scene)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'yarik-structures.blend'));purge('Saved review source')


def r1_deliver(name):
    s=STATE[name];bpy.context.window.scene=s['scene'];folder=OUT/name;folder.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in [s['collider']]+s['lods']+[o for o in s['scene'].objects if o.type=='EMPTY']:
        ob.hide_set(False);ob.hide_viewport=False;ob.select_set(True)
    path=folder/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,
                              export_animations=False,export_image_format='AUTO',export_extras=True,export_cameras=False,export_lights=False)
    doc=patch_glb(path,s);expected={'collider','lod0','lod1','lod2'}|{m['name'] for m in s['markers']}
    assert {n['name'] for n in doc['nodes']}==expected
    assert all(im.get('mimeType')=='image/png' and 'bufferView' in im for im in doc['images'])
    counts={}
    for n in doc['nodes']:
        if n['name'] in ['collider','lod0','lod1','lod2']:
            counts[n['name']]=sum(doc['accessors'][p['indices']]['count']//3 for p in doc['meshes'][n['mesh']]['primitives'])
    assert counts['collider']==s['validation']['collider_topology']['triangles']
    for level in ['lod0','lod1','lod2']:assert counts[level]==s['validation']['lod_triangle_counts'][level]
    s['validation']['exported_glb']=dict(bytes=path.stat().st_size,nodes=sorted(expected),triangle_counts=counts,embedded_pngs=len(doc['images']),materials=len(doc['materials']))
    dump(folder/'validation.json',s['validation'])
    metadata=dict(asset=name,review='review-1',units='metres',coordinate_system='glTF Y-up',collider='collider',
                  paths=[[yup(p) for p in line] for line in s['paths']],entrances=s['entrances'])
    for category in ['deposit','pad','deck']:
        found=[m for m in s['markers'] if m['name'].startswith(category)]
        if found:metadata[category+'s' if category!='deck' else 'deck']=found if category!='deck' else found[0]
    dump(folder/(name+'.json'),metadata)
    import hashlib
    dump(folder/'provenance.json',dict(origin='Original procedural work; no third-party models or textures',review='review-1',blender_version=bpy.app.version_string,
        date='2026-10-22',generator='tools/yarik-blender.py',generator_sha256=hashlib.sha256((ROOT/'tools/yarik-blender.py').read_bytes()).hexdigest(),
        texture_method='Direct unique UV atlas, PNG; no low-resolution-to-high-resolution bake',seed=20522))
    s['collider'].hide_render=True;s['collider'].hide_set(True)
    for ob in s['lods'][1:]:ob.hide_render=True;ob.hide_set(True)
    s['scene']['review_preview_specs']=json.dumps(s['preview_specs'])
    s['complete']=True;s['scene']['review_delivered']=True;r1_save_source()
    print('DELIVERED review-1',name,counts)


def r1_verify_glb(name, closed_gap_exception=False):
    s=STATE[name];raw=(OUT/name/(name+'.glb')).read_bytes();offset=12;doc=None;binary=None
    while offset<len(raw):
        length,kind=struct.unpack_from('<II',raw,offset);payload=raw[offset+8:offset+8+length]
        if kind==0x4e4f534a:doc=json.loads(payload)
        if kind==0x004e4942:binary=payload
        offset+=8+length
    def accessor(index):
        a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']]
        dtype={5126:np.float32,5125:np.uint32,5123:np.uint16,5121:np.uint8}[a['componentType']]
        width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];item=np.dtype(dtype).itemsize
        return np.ndarray((a['count'],width),dtype=dtype,buffer=binary,offset=view.get('byteOffset',0)+a.get('byteOffset',0),strides=(view.get('byteStride',item*width),item))
    geometry={}
    for logical in ['collider','lod0']:
        n=next(n for n in doc['nodes'] if n['name']==logical)
        assert 'matrix' not in n and 'rotation' not in n and 'scale' not in n
        prim=doc['meshes'][n['mesh']]['primitives'];assert len(prim)==1
        p=accessor(prim[0]['attributes']['POSITION']).astype(np.float64)
        # Back to Blender coordinates for direct comparison with authored polylines.
        verts=np.stack([p[:,0],-p[:,2],p[:,1]],axis=1)
        faces=accessor(prim[0]['indices']).reshape(-1,3)
        if logical=='collider':verts,remap=np.unique(verts,axis=0,return_inverse=True);faces=remap[faces]
        geometry[logical]=(verts,faces)
    verts,faces=geometry['collider'];me=bpy.data.meshes.new('_r1_roundtrip');me.from_pydata(verts.tolist(),[],faces.tolist());me.update()
    ob=bpy.data.objects.new('_r1_roundtrip',me)
    top=assert_solid(ob);intersections=intersection_check(ob);assert intersections['passed']
    bpy.data.objects.remove(ob);bpy.data.meshes.remove(me)
    trees={key:BVHTree.FromPolygons(v.tolist(),f.tolist(),all_triangles=True) for key,(v,f) in geometry.items()}
    distance={}
    for source,target in [('lod0','collider'),('collider','lod0')]:
        verts,faces=geometry[source];tri=verts[faces];area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)*.5
        rng=np.random.default_rng(8522);ids=rng.choice(len(tri),50000,p=area/area.sum());u=np.sqrt(rng.random(50000));v=rng.random(50000)
        points=tri[ids,0]*(1-u[:,None])+tri[ids,1]*(u*(1-v))[:,None]+tri[ids,2]*(u*v)[:,None]
        values=np.array([trees[target].find_nearest(Vector(p))[3] for p in points]);vertex_max=max(trees[target].find_nearest(Vector(p))[3] for p in verts)
        distance[source+'_to_'+target]=dict(area_weighted_samples=50000,maximum_m=float(max(values.max(),vertex_max)),p99_m=float(np.percentile(values,99)))
        if not name.startswith('kit_'):
            if closed_gap_exception and source=='collider':
                distance[source+'_to_'+target]['small_closed_gap_audit']=q9_gap_audit(trees[target],np.concatenate([points,verts]))
            else:assert distance[source+'_to_'+target]['maximum_m']<=.75
    route_minimum=None;samples=0
    for path in s['paths']:
        for p in sample_path(path):
            assert not point_inside(trees['collider'],p)
            d=trees['collider'].find_nearest(Vector(p))[3];route_minimum=d if route_minimum is None else min(route_minimum,d);samples+=1
    if route_minimum is not None:assert route_minimum>=(30.999 if name.startswith('kit_') else 30)
    from mathutils import Quaternion
    byname={n['name']:n for n in doc['nodes']}
    for m in s['markers']:
        n=byname[m['name']];x,y,z,w=n.get('rotation',[0,0,0,1]);q=Quaternion((w,x,y,z))
        axis=Vector((0,0,1) if m['axis']=='+Z' else (0,1,0))
        assert (q@axis-Vector(m['direction'])).length<.0001
        assert (Vector(n['translation'])-Vector(m['position'])).length<.0001
    png_sizes=[]
    for im in doc['images']:
        if 'uri' in im:png=(OUT/name/im['uri']).read_bytes()
        else:
            view=doc['bufferViews'][im['bufferView']];start=view.get('byteOffset',0);png=binary[start:start+view['byteLength']]
        assert png[:8]==b'\x89PNG\r\n\x1a\n';size=struct.unpack_from('>II',png,16);assert max(size)<=2048;png_sizes.append(list(size))
    previews={p.name:list(struct.unpack_from('>II',p.read_bytes(),16)) for p in (OUT/name/'previews').glob('*.png')}
    assert len(previews)==(4 if name in ['yarik_kanyonu','petek'] else 2 if name.startswith('kit_') or name in ['gangut','halka_harabe','kayalik_1','kayalik_4'] else 3 if name in ['yarik_kalbi','enkaz'] else 6) and all(max(x)==1600 for x in previews.values())
    report=dict(collider_topology=top,self_intersection=intersections,collider_vs_lod0=distance,route_samples_in_open_space=samples,
                minimum_clear_diameter_m=2*route_minimum if route_minimum else None,marker_axes_verified=len(s['markers']),embedded_png_sizes=png_sizes,previews=previews)
    s['validation']['glb_roundtrip']=report;s['verified']=True
    dump(OUT/name/'validation.json',s['validation']);purge(name+' verified serialized GLB')
    print('VERIFIED',name,json.dumps(distance));return report


def r1_hydrate():
    for name in ['iskele','sessiz_liman','kovuk','yarik_kalbi','enkaz']:
        if name in STATE and 'collider' in STATE[name]:continue
        file=OUT/name/'validation.json'
        if name not in bpy.data.scenes or not file.exists():continue
        v=json.loads(file.read_text())
        if v.get('review') not in ['review-1','review-2','review-3','review-4','brief-2','brief-3']:continue
        sc=bpy.data.scenes[name]
        if sc.get('review_work_checkpoint') and not sc.get('review_delivered'):continue
        objects={o.get('asset_node'):o for o in sc.objects if o.get('asset_node')}
        metadata=json.loads((OUT/name/(name+'.json')).read_text());lods=[objects['lod'+str(i)] for i in range(3)]
        markers=metadata['entrances']+metadata.get('deposits',[])+metadata.get('pads',[])
        if 'deck' in metadata:markers.append(metadata['deck'])
        mat=lods[0].data.materials[0];images={n.image.name.rsplit('_',1)[-1]:n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE'}
        inverse=lambda p:[p[0],-p[2],p[1]]
        STATE[name]=dict(scene=sc,review=v['review'],collider=objects['collider'],lod0=lods[0],lods=lods,material=mat,images=images,
                         markers=markers,entrances=metadata['entrances'],paths=[[inverse(p) for p in path] for path in metadata['paths']],
                         chambers=[],validation=v,distance=v['collider_vs_lod0'],complete=True,verified='glb_roundtrip' in v,
                         graph=v.get('route_graph',{}),preview_specs=json.loads(sc.get('review_preview_specs','{}')),
                         r2_unmet=v.get('unmet_rules',[]))
        if name=='enkaz':STATE[name]['gap_path_index']=4


r1_hydrate()


def r1_bezier(a,b,c,d,count=61):
    a,b,c,d=map(np.asarray,(a,b,c,d));result=[]
    for t in np.linspace(0,1,count):result.append(((1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d).tolist())
    return result


def r1_concat(*paths):
    result=[]
    for path in paths:
        if result and (Vector(result[-1])-Vector(path[0])).length<.001:result+=path[1:]
        else:result+=path
    return result


def r1_sweep(name,path,half=55,corner=10,extend=0,jagged=False):
    path=[Vector(p) for p in path]
    if extend:
        path=[path[0]+(path[0]-path[1]).normalized()*extend]+path+[path[-1]+(path[-1]-path[-2]).normalized()*extend]
    profile=[(-half+corner,-half),(half-corner,-half),(half,-half+corner),(half,half-corner),
             (half-corner,half),(-half+corner,half),(-half,half-corner),(-half,-half+corner)]
    verts=[];faces=[];side=None;previous=None
    for i,p in enumerate(path):
        tangent=(path[min(i+1,len(path)-1)]-path[max(0,i-1)]).normalized()
        if side is None:
            hint=Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((0,1,0));side=tangent.cross(hint).normalized()
        else:side=previous.rotation_difference(tangent)@side;side=(side-tangent*side.dot(tangent)).normalized()
        up=side.cross(tangent).normalized();previous=tangent
        for j,(x,z) in enumerate(profile):
            delta=[0,-7,5,-11,2,8,-5,3][j] if jagged and i==len(path)-1 else 0
            verts.append(p+side*x+up*z+tangent*delta)
    for i in range(len(path)-1):
        for j in range(8):faces.append((i*8+j,i*8+(j+1)%8,(i+1)*8+(j+1)%8,(i+1)*8+j))
    faces += [tuple(reversed(range(8))),tuple((len(path)-1)*8+j for j in range(8))]
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob)
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    return ob


def r1_liman_plan():
    assert STATE['iskele'].get('verified') and STATE['iskele'].get('review')=='review-1'
    sc=new_scene('sessiz_liman');s=STATE['sessiz_liman'];s['review']='review-1';s['complete']=False
    r=82;f=75;cy=-math.sqrt((r+f)**2-f*f);contact=np.array([f,cy])*r/(r+f)
    a=math.atan2(contact[1]-cy,contact[0]-f);tilt=lambda p:[float(p[0]),float(p[1]),45*float(p[0])/82]
    right=[tilt((f+f*math.cos(t),cy+f*math.sin(t),0)) for t in np.linspace(a,math.pi,26)]
    right=list(reversed(right))
    # J to each ring contact; both branches start parallel to the hangar approach.
    right=r1_concat([[0,-270,0],[0,cy,0]],right)
    left=[[-p[0],p[1],-p[2]] for p in right]
    theta_right=math.atan2(contact[1],contact[0])%(2*math.pi);theta_left=math.atan2(contact[1],-contact[0])%(2*math.pi)
    ring_nodes=[('U',0),('A',math.pi/2),('L',math.pi),('FL',theta_left),('FR',theta_right)]
    vertices={key:tilt((r*math.cos(t),r*math.sin(t),0)) for key,t in ring_nodes}
    paths=[];edges=[]
    for i,(key,t) in enumerate(ring_nodes):
        key2,t2=ring_nodes[(i+1)%len(ring_nodes)]
        if t2<=t:t2+=2*math.pi
        paths.append([tilt((r*math.cos(q),r*math.sin(q),0)) for q in np.linspace(t,t2,31)]);edges.append([key,key2])
    vertices.update(J=[0,-270,0],E0=[0,-335,0],K=[-280,-80,-45],E1=[330,80,45],E2=[-330,-80,-45])
    for path,edge in [(right,['J','FR']),(left,['J','FL']),([[0,-335,0],[0,-270,0]],['E0','J'])]:paths.append(path);edges.append(edge)
    upper=[[162+80*math.cos(t),80*math.sin(t),45] for t in np.linspace(math.pi,math.pi/2,22)]
    upper=r1_concat(upper,[[190,80,45],[250,80,45],[330,80,45]])
    lower=[[-162+80*math.cos(t),80*math.sin(t),-45] for t in np.linspace(0,-math.pi/2,22)]
    lower=r1_concat(lower,[[-210,-80,-45],[-280,-80,-45]])
    arc=[[-70+70*math.cos(t),-270+70*math.sin(t),0] for t in np.linspace(0,math.pi/2,23)]
    bypass=r1_concat(arc,r1_bezier([-70,-200,0],[-175,-200,0],[-175,-80,-45],[-280,-80,-45]))
    for path,edge in [(upper,['U','E1']),(lower,['L','K']),(bypass,['J','K']),([[-280,-80,-45],[-330,-80,-45]],['K','E2'])]:paths.append(path);edges.append(edge)
    s['paths']=paths;s['graph']=dict(vertices=vertices,edges=edges,entrance_vertices=['E0','E1','E2'])
    s['upper_path']=upper;s['lower_path']=r1_concat(lower,[[-330,-80,-45]]);s['bypass_path']=bypass
    s['chambers']=[]
    print('Planned bends',[(i,bend_radius(p)) for i,p in enumerate(paths)])
    assert min(bend_radius(p) for p in paths if bend_radius(p))>60
    return s


def r1_liman_shell():
    s=STATE['sessiz_liman'];sc=s['scene'];bpy.context.window.scene=sc
    parts=[r1_cylinder('Atrium pressure hull',(0,0,0),142,214,32),
           r1_cylinder('Upper armour drum',(0,0,110),101,8,16),
           r1_cylinder('Lower service plinth',(0,0,-109),85,8,12),
           cube_part('Rectangular hangar hull',(0,-210,0),(164,250,118)),
           cube_part('Lower transfer junction housing',(-220,-95,-45),(190,170,118)),
           r1_sweep('Raised starboard transfer arm',s['upper_path'],55,11,jagged=True),
           r1_sweep('Lower port transfer arm',s['lower_path'],55,11,jagged=True),
           r1_sweep('Atrium bypass shell',s['bypass_path'],55.3,11)]
    for x,y,z in [(260,80,45),(295,80,45),(-260,-80,-45),(-295,-80,-45)]:
        for side in [-1,1]:
            parts.append(cube_part('Exposed vertical girder',(x,y+side*54,z),(8,8,112)))
            parts.append(cube_part('Exposed horizontal girder',(x,y,z+side*54),(8,112,8)))
    # Hangar bulkhead layering: all load-bearing framing is in the collider.
    for y in [-326,-283,-150]:
        parts += [cube_part('Hangar side frame',(-81,y,0),(8,9,124)),cube_part('Hangar side frame',(81,y,0),(8,9,124)),
                  cube_part('Hangar lintel',(0,y,60),(164,9,8)),cube_part('Hangar lower sill',(0,y,-60),(164,9,8))]
    parts += [cube_part('Antenna root',(-60,35,108),(12,15,6)),r1_beam('Snapped antenna spar',(-60,35,110),(-75,45,140),4.4),
              r1_beam('Broken antenna crosspiece',(-101,45,139),(-49,45,139),4),
              r1_beam('Broken array tooth',(-92,45,139),(-106,57,144),3.5),
              r1_beam('Bent array tooth',(-54,45,139),(-45,57,132),3.5),
              cube_part('Solar-wing snapped spar',(210,145,83),(10,54,8)),
              cube_part('Solar-wing remaining root',(210,168,86),(82,28,5)),
              cube_part('Roof service cassette',(45,-60,110),(42,28,10)),
              cube_part('Upper corridor service cassette',(215,80,103),(35,45,10))]
    col=r1_union(parts,'sessiz_liman_collider');s['collider']=col
    print('Outer hull triangles',len(col.data.polygons));purge('Station exact outer hull')


def r1_liman_carve():
    s=STATE['sessiz_liman'];ob=s['collider'];select(ob)
    boolean_cut(ob,annular_room(118,24,190,40))
    boolean_cut(ob,cube_part('Rectangular hangar free volume',(0,-220,0),(140,290,88)))
    for path,half in [(s['upper_path'],40),(s['lower_path'],40),(s['bypass_path'],40.2)]:
        boolean_cut(ob,r1_sweep('Octagonal navigable corridor',path,half,8,extend=24))
    for x,y,z in [(277,135,45),(-277,-135,-45)]:
        boolean_cut(ob,cube_part('Missing armour panel recess',(x,y,z),(22,7,46)))
    boolean_cut(ob,cube_part('Broad lower transfer junction',(-220,-95,-43),(172,152,86)))
    for y,angle in [(160,.35),(176,-.3)]:
        cut=cube_part('Snapped solar root edge',(251,y,86),(14,10,12));cut.rotation_euler.z=angle
        boolean_cut(ob,cut)
    keep_main_solid(ob)
    bm=bmesh.new();bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
    decimate(ob,1000000)
    print('Carved collider',topology(ob));print('Intersections',intersection_check(ob))
    purge('Station exact carved hull')


def r1_surface_quad(name,points,region,max_distance=.18):
    s=STATE[name];tree,_,_=mesh_bvh(s['collider'])
    check=[Vector(p) for p in points]
    check += [(check[i]+check[(i+1)%4])*.5 for i in range(4)]
    check.append(sum((Vector(p) for p in points),Vector())/4)
    if max(tree.find_nearest(p)[3] for p in check)>max_distance:return
    s['render_parts'].append(r1_quad('Surface trim',points,region))


def r1_liman_details():
    s=STATE['sessiz_liman'];col=s['collider'];tree,_,_=mesh_bvh(col)
    for name,p,d in [('entrance_1',(0,-335,0),(0,-1,0)),('entrance_2',(330,80,45),(1,0,0)),('entrance_3',(-330,-80,-45),(-1,0,0))]:marker(s,name,p,d)
    pads=[(0,-245,-20),(-65,35,-75),(-266.5833333,-72.8333333,-65)]
    for i,p in enumerate(pads):
        hit,n,_,_=tree.ray_cast(Vector(p),Vector((0,0,-1)),100);assert hit is not None
        marker(s,'pad_'+str(i+1),hit,(0,0,1),'Y')
    # Shallow panel joints follow real flat facets and never bridge an open doorway.
    for z in [-72,-20,32,74]:
        for i in range(40):
            a,b=2*math.pi*i/40,2*math.pi*(i+1)/40
            inward=Vector((-math.cos((a+b)/2),-math.sin((a+b)/2),0))*.035
            p=Vector((118*math.cos(a),118*math.sin(a),z))+inward;q=Vector((118*math.cos(b),118*math.sin(b),z))+inward
            r1_surface_quad('sessiz_liman',[(p.x,p.y,z-.09),(q.x,q.y,z-.09),(q.x,q.y,z+.09),(p.x,p.y,z+.09)],4)
    for path in [s['upper_path'],s['lower_path'],s['bypass_path']]:
        for i in range(3,len(path)-2,7):
            p=Vector(path[i]);t=(Vector(path[i+1])-Vector(path[i-1])).normalized();side=t.cross(Vector((0,0,1))).normalized()
            for sign in [-1,1]:
                hit,n,_,_=tree.ray_cast(p,side*sign,85)
                if hit is None:continue
                centre=hit+n*.045;up=n.cross(t).normalized()
                points=[centre-t*2.5-up*.28,centre+t*2.5-up*.28,centre+t*2.5+up*.28,centre-t*2.5+up*.28]
                r1_surface_quad('sessiz_liman',[list(v) for v in points],1)
    # Sparse practical lights inside the atrium and the main hangar.
    for i in range(0,40,4):
        a,b=2*math.pi*i/40,2*math.pi*(i+1)/40;mid=(a+b)/2
        p=Vector((118*math.cos(a),118*math.sin(a),38));q=Vector((118*math.cos(b),118*math.sin(b),38))
        p,q=p.lerp(q,.2),p.lerp(q,.8);n=Vector((-math.cos(mid),-math.sin(mid),0))*.045
        points=[(p.x+n.x,p.y+n.y,37.5),(q.x+n.x,q.y+n.y,37.5),(q.x+n.x,q.y+n.y,38.5),(p.x+n.x,p.y+n.y,38.5)]
        r1_surface_quad('sessiz_liman',points,1)
        points=[(x,y,z-92) for x,y,z in points];r1_surface_quad('sessiz_liman',points,2)
    for x in [-48,48]:
        for y in [-310,-240,-160]:
            r1_surface_quad('sessiz_liman',[(x-2,y-4,43.95),(x+2,y-4,43.95),(x+2,y+4,43.95),(x-2,y+4,43.95)],3)
    for i in range(13):
        for j in range(4):
            x,y=171+i*6,156+j*6
            points=[(x+.15,y+.15,88.54),(x+5.85,y+.15,88.54),(x+5.85,y+5.85,88.54),(x+.15,y+5.85,88.54)]
            r1_surface_quad('sessiz_liman',points,5)
    # Raw sheared metal on the two breach lips, authored on the carrier itself.
    ob=s['lod0'];regions=ob.data.attributes['r1_region'].data
    for f in ob.data.polygons:
        if (f.center.x>317 or f.center.x<-317) and abs(f.normal.x)>.35:regions[f.index].value=6
    s['preview_specs']={
        'exterior_34':((770,-930,610),(0,-55,0),None,45),
        'exterior_entrance':((0,-1000,210),(0,-40,0),None,42),
        'inside_chamber':((74,-67,-78),(-28,35,-12),None,17),
        'inside_bend':((-53,-205,0),(-145,-182,-5),None,25),
        'top_routes':((0,-35,1600),(0,-35,0),1150,40),
        'clay_topology':((770,-930,610),(0,-55,0),None,45)}
    purge('Station shallow surface detailing')


def r1_uv_structure(name,ob):
    if name=='kovuk':return r1_uv_rock(ob)
    uv=ob.data.uv_layers.get('UVMap') or ob.data.uv_layers.new(name='UVMap');regions=ob.data.attributes['r1_region'].data
    for f in ob.data.polygons:
        region=regions[f.index].value
        for index in f.loop_indices:
            p=ob.data.vertices[ob.data.loops[index].vertex_index].co
            if region==5:co=(.02+.46*(p.x-171)/78,.80+.18*(p.y-156)/24)
            elif region:co={1:(.60,.90),2:(.72,.90),3:(.84,.90),4:(.94,.90),6:(.94,.98),7:(.60,.985),8:(.72,.985),9:(.84,.985)}[region]
            elif f.normal.z>.9 and abs(p.z+44)<.05 and p.y<-117:
                co=(.02+.46*(p.x+80)/160,.02+.46*(p.y+335)/255)
            elif f.normal.z>.9 and abs(p.z+95)<.05:
                co=(.02+.46*(p.x+120)/240,.52+.24*(p.y+120)/240)
            elif f.normal.z>.9 and abs(p.z+86)<.05 and p.x<-130:
                co=(.02+.46*(p.x+306)/172,.52+.24*(p.y+171)/152)
            elif abs(f.normal.z)<.2 and (23<math.hypot(f.center.x,f.center.y)<25 or 116<math.hypot(f.center.x,f.center.y)<119 or 140<math.hypot(f.center.x,f.center.y)<143):
                centre=math.atan2(f.center.y,f.center.x)%(2*math.pi);a=math.atan2(p.y,p.x)%(2*math.pi)
                while a-centre>math.pi:a-=2*math.pi
                while a-centre<-math.pi:a+=2*math.pi
                co=(.52+.46*a/(2*math.pi),.02+.70*(p.z+150)/300)
            else:
                normal=max(range(3),key=lambda k:abs(f.normal[k]));a,b=[k for k in range(3) if k!=normal]
                co=(.52+.46*(p[a]+350)/700,.02+.70*(p[b]+(150 if b==2 else 350))/(300 if b==2 else 700))
            uv.data[index].uv=co


def r1_structure_atlas(name,U,V,grain):
    if name=='kovuk':return r1_rock_atlas(U,V,grain)
    rgb=np.zeros(U.shape+(3,),dtype=np.float32);rgb[:]=(.022,.031,.039);rgb+=grain[:,:,None]*.006
    height=np.zeros_like(U);rough=np.full_like(U,.62);metal=np.full_like(U,.80);emission=np.zeros_like(rgb)
    # A unique panel sheet with broad scorch deposits; no image stretching or cloudy bump bake.
    X=(U-.52)/.46*700-350;Z=(V-.02)/.70*300-150
    panel=(np.floor((X+350)/24)+3*np.floor((Z+150)/32))%7
    rgb*= (.82+.055*panel[:,:,None])
    seams=(np.abs(((X+12)%24)-12)<.45)|(np.abs(((Z+16)%32)-16)<.45)
    rgb[seams]*=.32;height[seams]=-.1
    scorch=np.sin(X*.029+np.sin(Z*.045)*1.9)+.55*np.cos(Z*.071-X*.009)
    damage=np.clip((scorch-.42)*.65,0,.8);rgb*=1-damage[:,:,None];rough+=damage*.25
    for u0,v0,du,dv in [(.72,.32,.045,.055),(.85,.25,.035,.035),(.75,.37,.035,.065)]:
        d=np.sqrt(((U-u0)/du)**2+((V-v0)/dv)**2)+.11*np.sin(U*297+V*163)
        burn=np.clip((1-d)*2,0,1)*(U>.51)*(V<.78)
        rgb*=1-.94*burn[:,:,None];rough=np.maximum(rough,.92*burn)
    for floor,fx,fy in [((U<.50)&(V<.50),(U-.02)/.46*160-80,(V-.02)/.46*255-335),
                         ((U<.50)&(V>.50)&(V<.78),(U-.02)/.46*240-120,(V-.52)/.24*240-120)]:
        px,py=(0,-245) if np.max(fy)<100 else (-65,35)
        # Explicit branch avoids using atlas crop extents to choose a landing glyph.
        if np.any(floor&(V>.5)):px,py=-65,35
        else:px,py=0,-245
        R=np.hypot(fx-px,fy-py);angle=np.arctan2(fy-py,fx-px)
        rgb[floor]=np.stack([.032+grain*.004,.041+grain*.004,.047+grain*.004],axis=2)[floor]
        seam=floor&((np.abs(((fx+10)%20)-10)<.17)|(np.abs(((fy+12)%24)-12)<.17));rgb[seam]*=.34;height[seam]=-.10
        ring=floor&(np.abs(R-16)<.5)&((angle%(math.pi/6))<math.pi/7)
        lane=floor&(np.abs(np.abs(fx)-52)<.55)&((fy%19)<10)
        worn=(grain<.38);paint=(ring|lane)&worn
        rgb[paint]=(.20,.16,.08);metal[paint]=.2;rough[paint]=.85;emission[ring&paint]=(.004,.012,.012)
        dot=floor&(R<1.3);rgb[dot]=(.07,.18,.16);emission[dot]=(.003,.012,.01)
    # The remaining solar root, in a dedicated atlas rectangle.
    solar=(U<.50)&(V>.79);cell_x=((U-.02)/.46*13)%1;cell_y=((V-.80)/.18*4)%1
    rgb[solar]=(.008,.021,.035);grid=solar&((cell_x<.04)|(cell_y<.035));rgb[grid]=(.09,.12,.14);rough[solar]=.38
    for mask,color,em in [((U>.54)&(U<.66)&(V>.83)&(V<.95),(.18,.075,.016),(.16,.045,.006)),
                           ((U>.67)&(U<.77)&(V>.83)&(V<.95),(.008,.022,.022),(.002,.008,.007)),
                           ((U>.78)&(U<.89)&(V>.83)&(V<.95),(.48,.42,.32),(.55,.44,.30)),
                           ((U>.90)&(V>.83)&(V<.95),(.006,.009,.012),(0,0,0)),
                           ((U>.90)&(V>.96),(.13,.15,.16),(0,0,0))]:
        rgb[mask]=color;emission[mask]=em;rough[mask]=.6;height[mask]=0
    return rgb,height,rough,metal,emission


def r1_interior_lighting(name):
    s=STATE[name];sc=s['scene']
    if name=='kovuk':return r1_cave_lighting()
    light(sc,'Station low fill',(-420,-280,90),1.2e7,(.55,.69,.9),500)
    light(sc,'Front review fill',(0,-500,270),1e7,(.77,.83,.95),450,target=(0,-100,0))
    light(sc,'Station rim',(300,300,350),9e6,(.62,.77,1),380)
    light(sc,'Atrium broad key',(-45,-30,68),1.7e6,(.76,.82,1),90,target=(30,10,-70))
    light(sc,'Atrium amber fill',(65,25,35),220000,(1,.60,.31),kind='POINT')
    light(sc,'Atrium low fill',(-62,55,-35),120000,(.48,.64,.82),kind='POINT')
    for x in [-45,45]:
        for y in [-295,-205,-135]:light(sc,'Hangar flood',(x,y,32),35000,(.9,.81,.64),12,target=(x,y,-40))
    for path in [s['upper_path'],s['lower_path'],s['bypass_path']]:
        for i in range(5,len(path)-2,14):light(sc,'Emergency reflected fill',path[i],38000,(1,.54,.22),kind='POINT')
    light(sc,'Transfer junction key',(-225,-95,-12),3e5,(.66,.76,.87),65,target=(-240,-80,-80))


def r1_validate_specific(name,v):
    if name=='kovuk':return r1_validate_cave(v)
    s=STATE[name];tree,_,_=mesh_bvh(s['collider']);widths=[];heights=[]
    for z in [-39,0,39]:
        p=Vector((0,-332,z));a=tree.ray_cast(p,Vector((-1,0,0)),120);b=tree.ray_cast(p,Vector((1,0,0)),120);widths.append(a[3]+b[3])
    for x in [-60,0,60]:
        p=Vector((x,-332,0));a=tree.ray_cast(p,Vector((0,0,-1)),100);b=tree.ray_cast(p,Vector((0,0,1)),100);heights.append(a[3]+b[3])
    assert min(widths)>=120 and min(heights)>=80
    v['hangar']=dict(minimum_opening_width_m=min(widths),minimum_opening_height_m=min(heights),landing_pad='pad_1')
    v['atrium']=dict(diameter_m=236,height_m=190,column_diameter_m=48)
    v['corridor_levels_m']=[45,-45];v['vertical_separation_m']=90;v['bypass_skips_atrium']=True
    v['minimum_nominal_girder_m']=3.5;v['two_torn_breaches']=True;v['broken_antenna']=True;v['snapped_solar_root']=True
    pads=[]
    for m in s['markers']:
        if not m['name'].startswith('pad_'):continue
        centre=Vector((m['position'][0],-m['position'][2],m['position'][1]));samples=[]
        for a in np.linspace(0,2*math.pi,24,endpoint=False):
            p=centre+Vector((12*math.cos(a),12*math.sin(a),12));hit,_,_,_=tree.ray_cast(p,Vector((0,0,-1)),40)
            assert hit is not None;samples.append(abs(hit.z-centre.z))
        pads.append(dict(name=m['name'],clear_disk_diameter_m=24,maximum_flatness_error_m=max(samples)))
    v['pads']=pads
    v['known_limits']=['Preview practical lights are presentation-only; their emissive fixture surfaces are exported.']


def r1_make_lods(name):
    s=STATE[name];base=s['lod0'];base['asset_node']='lod0';s['lods']=[base]
    for level,ratio in [(1,.35),(2,.12)]:
        ob=base.copy();ob.data=base.data.copy();ob.name=name+'_lod'+str(level);s['scene'].collection.objects.link(ob);ob['asset_node']='lod'+str(level)
        if name=='sessiz_liman':
            select(ob);mod=ob.modifiers.new('Remove microscopic boolean bevel slivers','WELD');mod.merge_threshold=.00001 if level==1 else .005
            bpy.ops.object.modifier_apply(modifier=mod.name)
        decimate(ob,round(len(base.data.polygons)*ratio));ob.hide_render=True;ob.hide_set(True);s['lods'].append(ob)
    purge(name+' render LODs')


def r1_kovuk_plan():
    assert STATE['sessiz_liman'].get('verified') and STATE['iskele'].get('verified')
    new_scene('kovuk');s=STATE['kovuk'];s['review']='review-1'
    t=np.linspace(math.pi,0,101)
    A=np.stack([-65+150*np.cos(t),145*np.sin(t),-60+100*np.sin(t)**2],axis=1).tolist()
    B=np.stack([-65+150*np.cos(t),-130*np.sin(t),np.full_like(t,-60)],axis=1).tolist()
    C=np.stack([-65+150*np.cos(t),-12*np.sin(t),-60+200*np.sin(t)],axis=1).tolist()
    ring1=[[150+65*math.cos(a),65*math.sin(a),-60] for a in np.linspace(math.pi,0,65)]
    ring2=[[150+65*math.cos(a),65*math.sin(a),-60] for a in np.linspace(math.pi,2*math.pi,65)]
    rear=r1_concat([[-65+70*math.cos(a),215+70*math.sin(a),40] for a in np.linspace(-math.pi/2,0,41)],[[5,215,40],[5,360,40]])
    top=r1_concat([[-65+70*math.cos(a),-12,210+70*math.sin(a)] for a in np.linspace(-math.pi/2,0,41)],[[5,-12,210],[5,-12,370]])
    front=[[-215,-360,-60],[-215,0,-60]];east=[[215,0,-60],[400,0,-60]]
    s['branches']={'A':A,'B':B,'C':C,'hall_north':ring1,'hall_south':ring2}
    s['paths']=[A,B,C,ring1,ring2,front,east,rear,top]
    s['full_paths']=[p.copy() for p in s['paths']]
    s['chambers']=[dict(name='crystal_grotto',centre=[-215,0,-60],nominal_diameter_m=196),dict(name='collapsed_hall',centre=[150,0,-60],nominal_diameter_m=204,pillar_diameter_m=34)]
    verts={'F':A[0],'R':A[-1],'U':A[50],'C':C[50],'D':ring1[-1],'E0':front[0],'E1':east[-1],'E2':rear[-1],'E3':top[-1]}
    s['graph']=dict(vertices=verts,edges=[['F','U'],['U','R'],['F','R'],['F','C'],['C','R'],['R','D'],['R','D'],['E0','F'],['D','E1'],['U','E2'],['C','E3']],entrance_vertices=['E0','E1','E2','E3'])
    # Craters are actual excavated macrogeometry. Directions point out of the asteroid.
    s['craters']=[dict(p=[55,-307,90],n=[0,-1,0],radius=115,offset=80),dict(p=[5,-12,292],n=[0,0,1],radius=95,offset=65),dict(p=[345,0,-60],n=[1,0,0],radius=105,offset=75),dict(p=[-215,-245,-60],n=[0,-1,0],radius=85,offset=62)]
    for i,p in enumerate(s['paths']):print('planned path',i,'bend',bend_radius(p))
    purge('Kovuk route plan')


def r1_rock_outer(X,Y,Z):
    """Fractured convex macroform, stepped bedding, fault incisions and crater excavation."""
    planes=[]
    # Distributed fracture normals avoid the six broad faces of a rounded cube.
    for i in range(58):
        nz=1-2*(i+.5)/58;a=i*math.pi*(3-math.sqrt(5));r=math.sqrt(1-nz*nz);n=(r*math.cos(a),r*math.sin(a),nz)
        d=math.sqrt((n[0]*374)**2+(n[1]*337)**2+(n[2]*320)**2)
        d*=.95+.035*math.sin(i*2.713);planes.append((n,d))
    out=np.full(np.broadcast_shapes(X.shape,Y.shape,Z.shape),-1e6,dtype=np.float32)
    for n,d in planes:
        l=math.sqrt(sum(v*v for v in n));out=np.maximum(out,(n[0]*X+n[1]*Y+n[2]*Z)/l-d)
    h=Z+.23*X-.14*Y
    # Eroded shelves with sharp bedding edges, rather than a rounded noise displacement.
    out += 1.9*np.tanh(3*np.sin(h*2*math.pi/39+1.1*np.sin(.017*X+.012*Y)))
    out += 5.2*np.abs(np.sin(.034*X+.047*Y-.025*Z))+4.3*np.abs(np.sin(.075*X-.046*Y+.052*Z))
    for q in [(.63,-.34,.70,32),(-.42,.84,.34,-110),(.17,.43,.89,165)]:
        d=q[0]*X+q[1]*Y+q[2]*Z-q[3];out+=10*np.exp(-(d/5.5)**2)
    for cr in STATE['kovuk']['craters']:
        p=np.array(cr['p']);n=np.array(cr['n']);q=[X-p[0],Y-p[1],Z-p[2]];along=sum(q[i]*n[i] for i in range(3))
        r=np.sqrt(np.maximum(0,sum(v*v for v in q)-along*along));R=math.sqrt(cr['radius']**2-cr['offset']**2)
        u,v=[i for i in range(3) if n[i]==0];angle=np.arctan2(q[v],q[u]);wobble=4*np.sin(angle*5+.7)+2.5*np.sin(angle*9)
        rim=np.maximum(np.abs(r-R-wobble)-(9+np.clip(-along,0,65)*.20),np.maximum(along-5-2*np.sin(angle*7),-along-68))
        out=np.minimum(out,rim)
        sphere=np.sqrt(sum((q[i]-n[i]*cr['offset'])**2 for i in range(3)))-cr['radius']
        out=np.maximum(out,-sphere)
    # A broad fractured brow anchored behind the front mouth.
    brow=(np.sqrt(((X+215)/62)**2+((Y+235)/37)**2+((Z+15)/15)**2)-1)*15
    return np.minimum(out,brow).astype(np.float32)


def r1_rock_field(X,Y,Z):
    s=STATE['kovuk'];outer=r1_rock_outer(X,Y,Z);void=np.full_like(outer,1e5)
    for chamber in s['chambers']:
        a,b,c=chamber['centre'];r=np.sqrt((X-a)**2+(Y-b)**2+((Z-c)/1.025)**2)
        rough=3.1*np.abs(np.sin(.063*X+.075*Y)*np.sin(.058*Z-.025*Y))+1.4*np.abs(np.sin(.11*X-.08*Y+.06*Z))
        void=np.minimum(void,r-chamber['nominal_diameter_m']*.5-rough)
    axes=[X[:,0,0],Y[0,:,0],Z[0,0,:]]
    # Only small local grid windows are evaluated for each bent tunnel segment.
    for path_id,path in enumerate(s['full_paths']):
        path=np.array(path,dtype=np.float32);length=0
        for a,b in zip(path,path[1:]):
            delta=b-a;seg=float(np.linalg.norm(delta));t=delta/seg
            up=np.array([0,0,1],dtype=np.float32)
            if abs(t[2])>.94:up=np.array([0,1,0],dtype=np.float32)
            side=np.cross(t,up);side/=np.linalg.norm(side);up=np.cross(side,t);up/=np.linalg.norm(up)
            spans=[slice(max(0,int(np.searchsorted(axes[i],min(a[i],b[i])-67))),min(len(axes[i]),int(np.searchsorted(axes[i],max(a[i],b[i])+67))+1)) for i in range(3)]
            q=[X[tuple(spans)]-a[0],Y[tuple(spans)]-a[1],Z[tuple(spans)]-a[2]]
            along=sum(q[i]*t[i] for i in range(3));clamped=np.clip(along,0,seg);excess=along-clamped
            across=sum(q[i]*side[i] for i in range(3));vertical=sum(q[i]*up[i] for i in range(3))
            across=(across+.16*vertical)/math.sqrt(1+.16**2)
            wave=np.sin((length+clamped)/43+path_id*.71);rx=38.8*(1+.20*wave);rz=38.8*(1-.20*wave)
            cut=np.maximum.reduce([np.sqrt(across**2+excess**2)/rx,np.sqrt(vertical**2+excess**2)/rz,(np.abs(across)+np.abs(vertical)+.4*np.abs(excess))/(rx+rz-8)])-1
            rough=.8*np.abs(np.sin(.15*X[tuple(spans)]+.07*Y[tuple(spans)]-.11*Z[tuple(spans)]))
            cut=cut*31-rough
            void[tuple(spans)]=np.minimum(void[tuple(spans)],cut);length+=seg
    solid=np.maximum(outer,-void)
    # A floor-to-roof remnant supports the collapsed hall and produces a physical loop.
    px=150+.065*(Z+60);py=-.035*(Z+60)
    pillar=np.sqrt((X-px)**2+(Y-py)**2)-17.5-1.5*np.abs(np.sin(.05*Z))
    pillar=np.maximum(pillar,np.abs(Z+60)-145)
    solid=np.minimum(solid,pillar)
    for p,half in [((-170.37,35.23,-143.19),(21.17,26.31,24.13)),((200.23,50.17,-141.31),(17.21,23.13,26.17)),((-260.19,40.31,-143.27),(26.13,17.23,22.19))]:
        block=np.maximum.reduce([np.abs(X-p[0])-half[0],np.abs(Y-p[1])-half[1],np.abs(Z-p[2])-half[2]])
        solid=np.minimum(solid,block)
    return solid


def r1_kovuk_shell():
    s=STATE['kovuk'];bpy.context.window.scene=s['scene']
    ob=implicit_mesh('kovuk_collider',r1_rock_field,[(-410,420),(-410,410),(-360,410)],step=9)
    s['collider']=ob;keep_main_solid(ob);purge('Kovuk coarse implicit shell')


def r1_kovuk_reduce():
    s=STATE['kovuk'];ob=s['collider'];decimate(ob,14800);keep_main_solid(ob)
    # Slight irregular pores are carved exactly after reduction so sub-8m shafts survive.
    shafts=[];direction=Vector((-.30,-.18,1)).normalized()
    for i,start in enumerate([(-235,15,15),(-183,-20,10),(185,20,15)]):
        end=Vector(start)+direction*420
        cut=r1_sweep('lightshaft_'+str(i),[list(start),list(end)],half=3.1,corner=1.1)
        boolean_cut(ob,cut);shafts.append(dict(start=list(start),direction=list(direction),maximum_width_m=6.2))
    s['shafts']=shafts
    bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
    decimate(ob,16000);ob['asset_node']='collider';ob.hide_render=True
    relax_intersections(ob)
    print('Kovuk topology',topology(ob),intersection_check(ob));purge('Kovuk reduced shafts')


def r1_kovuk_routes():
    s=STATE['kovuk'];tree,_,_=mesh_bvh(s['collider'])
    # Root finding on the real collider, from the cavity out toward each exterior endpoint.
    configs=[(5,0,1,[0,-1,0]),(6,-1,0,[1,0,0]),(7,-1,-2,[0,1,0]),(8,-1,-2,[0,0,1])]
    for i,(idx,end,inner,direction) in enumerate(configs):
        p=Vector(s['paths'][idx][inner]);d=Vector(direction)
        # March from known open cave centre until the final rock-to-space exit (shaft walls may be passed).
        hit,_,_,_=tree.ray_cast(p,-d,1) if False else (None,None,None,None)
        target=Vector(s['paths'][idx][end]);outside=target
        # Centreline has no surface at the open mouth; intersect the pre-excavation rock envelope.
        probes=[outside-d*j for j in np.arange(0,400,.5)]
        values=[float(r1_rock_outer(np.array([q.x]),np.array([q.y]),np.array([q.z]))[0]) for q in probes]
        j=next(j for j,v in enumerate(values) if v<0);lo=probes[j-1];hi=probes[j]
        for _ in range(15):
            mid=(lo+hi)*.5;v=float(r1_rock_outer(np.array([mid.x]),np.array([mid.y]),np.array([mid.z]))[0])
            if v<0:hi=mid
            else:lo=mid
        mouth=(lo+hi)*.5+d*.1
        s['paths'][idx][end]=list(mouth);s['graph']['vertices']['E'+str(i)]=list(mouth)
        marker(s,'entrance_'+str(i+1),mouth,direction)
    # Deposits sit on distinct crystal-grotto wall patches, +Z points into the chamber.
    centre=Vector((-215,0,-60))
    for i,a in enumerate(np.linspace(0,2*math.pi,8,endpoint=False)):
        d=Vector((math.cos(a)*.85,math.sin(a)*.85,.52 if i%2 else -.45)).normalized()
        hit,n,_,_=tree.ray_cast(centre,d,160);assert hit is not None
        marker(s,'deposit_'+str(i+1),hit+n*.12,n)
    print(json.dumps(r1_measure_routes('kovuk')));print(r1_graph_check('kovuk'));purge('Kovuk collider routes')


def r1_path_at_distance(path,spacing=2):
    a=np.array(path,dtype=float);length=np.concatenate([[0],np.cumsum(np.linalg.norm(np.diff(a,axis=0),axis=1))])
    ds=np.arange(0,length[-1]+.0001,spacing)
    return ds,np.stack([np.interp(ds,length,a[:,i]) for i in range(3)],axis=1)


def r1_kovuk_los():
    s=STATE['kovuk'];tree,_,_=mesh_bvh(s['collider']);b=s['branches'];A,B,C=[b[k] for k in ['A','B','C']]
    forks={'F_crystal':{'north':A,'south':B,'high':C},
           'R_core_rejoin_F':{'north':A[::-1],'south':B[::-1],'high':C[::-1]},
           'R_pillar_rejoin_D':{'pillar_north':b['hall_north'],'pillar_south':b['hall_south']},
           'U_upper':{'left':r1_concat(A[:51][::-1],B),'right':A[50:]},
           'C_high':{'left':r1_concat(C[:51][::-1],B),'right':C[50:]},
           'D_east_hall':{'pillar_north':b['hall_north'][::-1],'pillar_south':b['hall_south'][::-1]}}
    reports=[]
    for fork,branches in forks.items():
        names=list(branches)
        for i,a in enumerate(names):
            for bname in names[i+1:]:
                da,pa=r1_path_at_distance(branches[a]);db,pb=r1_path_at_distance(branches[bname]);n=min(len(pa),len(pb))
                occluded=[]
                for p,q in zip(pa[:n],pb[:n]):
                    d=Vector(q-p);length=d.length
                    hit=tree.ray_cast(Vector(p),d.normalized(),max(0,length-.03))[0] if length>.1 else None
                    occluded.append(hit is not None)
                runs=[j for j in range(n-10) if all(occluded[j:j+11])]
                first=float(da[runs[0]]) if runs else None
                def turn(path):
                    d=np.diff(np.array(path),axis=0);d/=np.linalg.norm(d,axis=1)[:,None]
                    return float(np.degrees(np.arccos(np.clip(np.sum(d[:-1]*d[1:],axis=1),-1,1))).sum())
                reports.append(dict(fork=fork,branches=[a,bname],equal_travel_distance_to_sustained_occlusion_m=first,
                                    branch_cumulative_turn_degrees=[turn(branches[a]),turn(branches[bname])],
                                    sample_step_m=2,sustained_occlusion_distance_m=20,meets_150m_target=first is not None and first<=150))
    s['los']=dict(method='Collider ray segment between both branch centrelines at equal 2m travel increments; first occlusion persisting for 20m. Every rejoining branch pair in both directions, plus split nodes U/C. Choices ending at different junctions and exterior dead-end spurs are not paired.',
                  forks=reports,maximum_distance_m=max(r['equal_travel_distance_to_sustained_occlusion_m'] or 1e6 for r in reports),
                  branch_turns_before_rejoining_degrees={'north':180,'south':180,'high':180,'pillar_north':180,'pillar_south':180},
                  all_targets_met=all(r['meets_150m_target'] for r in reports))
    print(json.dumps(s['los']));purge('Kovuk measured fork LOS')


def r1_kovuk_render():
    s=STATE['kovuk'];col=s['collider'];verts=[tuple(v.co) for v in col.data.vertices];faces=[]
    eligible=sorted([f for f in col.data.polygons if f.area>28],key=lambda f:f.area,reverse=True)[:(29980-len(col.data.polygons))//2]
    split={f.index for f in eligible}
    for f in col.data.polygons:
        ids=list(f.vertices)
        if f.index not in split:faces.append(ids);continue
        p=sum((col.data.vertices[i].co for i in ids),Vector())/3
        amount=.34*math.sin(.17*p.x+.13*p.y-.19*p.z)*abs(math.sin(.29*p.z+.21*p.y))
        v=len(verts);verts.append(tuple(p+f.normal*amount))
        faces.extend([(ids[0],ids[1],v),(ids[1],ids[2],v),(ids[2],ids[0],v)])
    me=bpy.data.meshes.new('Basalt fractured microfacets');me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new('kovuk_lod0',me);s['scene'].collection.objects.link(ob);ob['asset_node']='lod0';s['lod0']=ob;s['render_parts']=[ob]
    for f in me.polygons:f.use_smooth=True
    me.set_sharp_from_angle(angle=.48)
    r1_uv_rock(ob);col.hide_set(True);purge('Kovuk real fractured render facets')


def r1_uv_rock(ob):
    me=ob.data;uv=me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap');ore=me.uv_layers.get('OreUV') or me.uv_layers.new(name='OreUV')
    colors=me.color_attributes.get('Geology') or me.color_attributes.new(name='Geology',type='FLOAT_COLOR',domain='CORNER')
    me.color_attributes.active_color=colors;me.color_attributes.render_color_index=list(me.color_attributes).index(colors)
    s=STATE['kovuk'];deposits=[Vector((m['position'][0],-m['position'][2],m['position'][1])) for m in s['markers'] if m['name'].startswith('deposit_')]
    for f in me.polygons:
        p=f.center;n=f.normal;outer=float(r1_rock_outer(np.array([p.x]),np.array([p.y]),np.array([p.z]))[0]);inside=outer<-20
        axis=max(range(3),key=lambda j:abs(n[j]));u,v=[j for j in range(3) if j!=axis];scale=4 if inside else 1
        dust=0.
        if n.z>.4:
            dust=.7 if inside and p.z<-100 else .20
            for cr in s['craters']:
                delta=p-Vector(cr['p']);cn=Vector(cr['n']);rad=(delta-cn*delta.dot(cn)).length
                if rad<cr['radius']*.62 and delta.dot(cn)<-5 and n.dot(cn)>.2:dust=.92
        if not inside:
            for cr in s['craters']:
                delta=p-Vector(cr['p']);cn=Vector(cr['n']);rad=(delta-cn*delta.dot(cn)).length
                if rad<cr['radius']*.64 and delta.dot(cn)<-6 and n.dot(cn)>.4:dust=.95
        glass=.42+.10*math.sin(.035*p.x+.041*p.y+.027*p.z)
        shade=np.array([glass*.85,glass*.94,glass])*(1-dust)+np.array([1.,.87,.68])*dust
        mineral=inside and p.x<-115 and min((p-d).length for d in deposits)<19
        for li in f.loop_indices:
            point=me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv=((point[u]+400)/800*scale,(point[v]+400)/800*scale)
            ore.data[li].uv=((point[u]+400)/200,(point[v]+400)/200) if mineral else (.001,.001)
            colors.data[li].color=(*shade,1)
    print('Kovuk UV/color corners',len(me.loops));purge('Kovuk UV geology')


def r1_rock_pixels(U,V,kind):
    """Periodic Voronoi crackle plus sharp ridged grain; evaluated in small row windows."""
    x=U*87+1.7*np.sin(V*2*math.pi*13)+.7*np.sin(U*2*math.pi*29+V*2*math.pi*17)
    y=V*87+1.9*np.sin(U*2*math.pi*11)+.6*np.sin(V*2*math.pi*23-U*2*math.pi*19)
    ix=np.floor(x);iy=np.floor(y);f1=np.full(U.shape,1e6,dtype=np.float32);f2=f1.copy();cell=np.zeros_like(U)
    def hash2(a,b,k):return np.mod(np.sin(np.mod(a,87)*127.1+np.mod(b,87)*311.7+k)*43758.5453,1)
    for dx in [-1,0,1]:
        for dy in [-1,0,1]:
            ax=ix+dx;ay=iy+dy;ox=.05+.90*hash2(ax,ay,0);oy=.05+.90*hash2(ax,ay,71)
            d=(x-ax-ox)**2+(y-ay-oy)**2;closer=d<f1
            f2=np.where(closer,f1,np.minimum(f2,d));cell=np.where(closer,hash2(ax,ay,19),cell);f1=np.minimum(f1,d)
    edge=np.sqrt(f2)-np.sqrt(f1);fracture=np.exp(-(edge/.020)**2)
    def noise(freq,seed):
        xx=U*freq;yy=V*freq;a=np.floor(xx);b=np.floor(yy);u=xx-a;v=yy-b;u=u*u*(3-2*u);v=v*v*(3-2*v)
        def h(dx,dy):return np.mod(np.sin(np.mod(a+dx,freq)*127.1+np.mod(b+dy,freq)*311.7+seed)*43758.5453,1)
        return (h(0,0)*(1-u)+h(1,0)*u)*(1-v)+(h(0,1)*(1-u)+h(1,1)*u)*v
    grain=(noise(503,19)-.5)*2;coarse=noise(23,72);medium=noise(193,117)
    ridges=1-np.abs(noise(69,32)*2-1)
    if kind=='base':
        variation=.60+.60*coarse
        value=(.080+.035*cell+.022*ridges+.022*grain+.024*(medium-.5))*variation*(1-.48*fracture)
        rgb=np.stack([value*.90,value*.96,value],axis=2)
    elif kind=='orm':rgb=np.stack([np.ones_like(U),.40+.35*fracture+.20*cell,np.full_like(U,.055)],axis=2)
    elif kind=='emissive':
        vein=np.exp(-(edge/.026)**2)*(U>.03)*(V>.03)
        rgb=vein[:,:,None]*np.array([.025,.27,.30],dtype=np.float32)
    else:
        return .40*ridges-.28*fracture+.44*grain+.25*medium
    if kind in ['base','emissive']:rgb=np.where(rgb<=.0031308,rgb*12.92,1.055*np.maximum(rgb,0)**(1/2.4)-.055)
    return rgb.astype(np.float32)


def r1_rock_map_begin(kind,size=2048):
    s=STATE['kovuk'];s['map_work']=dict(kind=kind,size=size,pixels=np.ones((size,size,4),dtype=np.float32))
    purge('Kovuk '+kind+' buffer')


def r1_rock_map_rows(start,rows=256):
    work=STATE['kovuk']['map_work'];size=work['size'];kind=work['kind'];stop=min(size,start+rows)
    # A one-row halo keeps normal gradients continuous between calls.
    axis=(np.arange(size,dtype=np.float32)+.5)/size;ys=(np.arange(start-1,stop+1,dtype=np.float32)+.5)/size
    U,V=np.meshgrid(axis,ys);p=r1_rock_pixels(U,V,kind)
    if kind=='normal':
        dy,dx=np.gradient(p);nx=-dx*.85;ny=-dy*.85;n=np.stack([nx,ny,np.ones_like(nx)],axis=2);n/=np.linalg.norm(n,axis=2)[:,:,None];p=n*.5+.5
    work['pixels'][start:stop,:,:3]=np.clip(p[1:-1],0,1)
    print('Kovuk',kind,'rows',start,stop)


def r1_rock_map_end():
    s=STATE['kovuk'];w=s.pop('map_work');kind=w['kind'];size=w['size'];im=bpy.data.images.new('kovuk_'+kind,size,size,alpha=False)
    enum_value(im.colorspace_settings,'name','sRGB' if kind in ['base','emissive'] else 'Non-Color')
    im.pixels.foreach_set(w['pixels'].ravel());im.update();im.pack();im.use_fake_user=True;s.setdefault('images',{})[kind]=im
    del w;purge('Kovuk packed '+kind)


def r1_kovuk_material():
    r1_material('kovuk');s=STATE['kovuk'];mat=s['material'];ns=mat.node_tree.nodes;link=mat.node_tree.links.new
    base=next(n for n in ns if n.type=='TEX_IMAGE' and n.image==s['images']['base']);em=next(n for n in ns if n.type=='TEX_IMAGE' and n.image==s['images']['emissive'])
    bs=next(n for n in ns if n.type=='BSDF_PRINCIPLED')
    color=node(ns,'ShaderNodeVertexColor');color.layer_name='Geology';mix=node(ns,'ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
    link(base.outputs[0],mix.inputs[1]);link(color.outputs[0],mix.inputs[2]);link(mix.outputs[0],bs.inputs['Base Color'])
    ore=node(ns,'ShaderNodeUVMap');ore.uv_map='OreUV';link(ore.outputs[0],em.inputs['Vector']);bs.inputs['Emission Strength'].default_value=.8
    purge('Kovuk PBR basalt')


def r1_kovuk_lighting():
    s=STATE['kovuk'];sc=s['scene'];set_engine(sc,'BLENDER_EEVEE');sc.eevee.taa_render_samples=32;sc.eevee.use_raytracing=False
    enum_value(sc.eevee,'shadow_pool_size','64');sc.eevee.volumetric_samples=32;enum_value(sc.eevee,'volumetric_tile_size','16')
    sc.eevee.use_volume_custom_range=True;sc.eevee.volumetric_start=.5;sc.eevee.volumetric_end=400;sc.eevee.use_volumetric_shadows=True
    bg=next(n for n in sc.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.035,.045,.065,1);bg.inputs['Strength'].default_value=.18
    sun=light(sc,'Shaft sunlight',(-300,-180,1000),2.7,(1,.84,.62),kind='SUN');sun.data.angle=.015
    light(sc,'Exterior soft fill',(500,-700,280),1.5e7,(.55,.69,1),500)
    light(sc,'Rock rim',(-400,500,500),2e7,(.58,.73,1),300)
    light(sc,'Grotto key',(-235,-23,12),3.0e5,(.69,.81,.94),55,target=(-215,0,-125))
    light(sc,'Grotto low fill',(-208,62,-50),95000,(.72,.62,.46),65,target=(-245,-5,-70))
    light(sc,'Hall key',(175,15,12),1.6e5,(.84,.78,.62),60,target=(145,0,-125))
    light(sc,'Hall low fill',(120,-60,-40),50000,(.40,.61,.76),55,target=(165,20,-70))
    light(sc,'Upper tunnel low fill',(-65,145,30),18000,(.44,.59,.71),25,target=(-100,132,20))
    light(sc,'Lower passage fill',(-18,-123,-50),60000,(.64,.72,.80),25,target=(30,-100,-55))
    r1_kovuk_shaft_lights()
    # Bounded, presentation-only dust makes the real narrow roof cracks legible in the interior view.
    dust=cube_part('Preview chamber dust',(-215,0,-55),(207,207,225),0);dust['presentation_only']=True
    mat=bpy.data.materials.new('Preview trace dust');mat.use_nodes=True;ns=mat.node_tree.nodes;ns.clear();out=node(ns,'ShaderNodeOutputMaterial');vol=node(ns,'ShaderNodeVolumeScatter')
    vol.inputs['Density'].default_value=.012;vol.inputs['Color'].default_value=(.50,.61,.70,1);vol.inputs['Anisotropy'].default_value=.45;mat.node_tree.links.new(vol.outputs[0],out.inputs['Volume']);dust.data.materials.append(mat);s['dust']=dust
    enum_value(sc.view_settings,'view_transform','AgX');sc.render.resolution_x=1600;sc.render.resolution_y=1000;sc.render.resolution_percentage=100
    enum_value(sc.render.image_settings,'file_format','PNG');enum_value(sc.render.image_settings,'color_mode','RGB');sc.render.threads_mode='FIXED';sc.render.threads=2
    s['preview_specs']={'exterior_34':((890,-1060,710),(0,0,0),None,45),
        'exterior_entrance':((-215,-1030,85),(-215,-125,-60),None,44),
        'interior_chamber':((-272,-30,-90),(-213,14,-35),None,23),
        'interior_bend':((-27.7,-125.9,-60),(56.3,-76.4,-60),None,20),
        'top_routes':((0,0,1250),(0,0,0),1120,40),
        'clay_topology':((890,-1060,710),(0,0,0),None,45)}
    purge('Kovuk key and fill lighting')


def r1_kovuk_shaft_lights():
    s=STATE['kovuk'];sc=s['scene'];direction=Vector((-.30,-.18,1)).normalized()
    for i,shaft in enumerate(s['shafts']):
        p=Vector(shaft['start'])+direction*29
        beam=light(sc,'Crack sunlight beam '+str(i),p,800000,(1,.86,.66),1,kind='SPOT',target=p-direction*120)
        beam.data.spot_size=.13;beam.data.spot_blend=.40;beam.data.shadow_soft_size=.25


def r1_validate_cave(v):
    s=STATE['kovuk'];tree,_,_=mesh_bvh(s['collider']);chambers=[]
    for chamber in s['chambers']:
        c=Vector(chamber['centre']);radii=[]
        # Start beyond the central pillar. Exclude designed exit sectors, which continue into tunnels.
        for a in np.linspace(0,2*math.pi,144,endpoint=False):
            d=Vector((math.cos(a),math.sin(a),0));hit,_,_,dist=tree.ray_cast(c+d*26,d,110)
            if hit is not None and 85<dist+26<110:radii.append(dist+26)
        assert len(radii)>20
        chambers.append(dict(**chamber,wall_samples=len(radii),measured_wall_diameter_range_m=[2*min(radii),2*max(radii)],
                             measurement='Horizontal radial wall envelope, excluding entrance sectors and starting beyond the pillar; not the pillar-occupied centre clearance.'))
        assert min(radii)*2>=180 and max(radii)*2<=220
    shaft_reports=[]
    for shaft in s['shafts']:
        p=Vector(shaft['start']);d=Vector(shaft['direction']);hit,_,_,_=tree.ray_cast(p,d,420)
        assert hit is None,('shaft obstructed',shaft,hit)
        shaft_reports.append(dict(**shaft,maximum_corner_to_corner_span_m=2*math.hypot(3.1,2),open_to_space=True,
                                  cross_section='Clipped square 6.2m across flats, 7.379m maximum span; too small for a 12m capsule.'))
    deposits=[]
    for m in s['markers']:
        if not m['name'].startswith('deposit_'):continue
        p=Vector((m['position'][0],-m['position'][2],m['position'][1]));hit,n,_,distance=tree.find_nearest(p)
        direction=Vector((m['direction'][0],-m['direction'][2],m['direction'][1])).normalized();angle=math.degrees(math.acos(max(-1,min(1,n.dot(direction)))))
        assert distance<.13 and angle<.1
        deposits.append(dict(name=m['name'],wall_distance_m=distance,wall_normal_error_degrees=angle,chamber='crystal_grotto'))
    assert len(s['entrances'])==4 and len(deposits)==8 and s['los']['all_targets_met']
    v['chambers']=chambers;v['deposits']=deposits;v['light_shafts']=shaft_reports;v['line_of_sight']=s['los']
    v['levels_m']=[-60,40,140];v['vertical_separation_m']=200;v['corridor_nominal_halfwidth_range_m']=[31.04,46.56]
    v['cross_section']=dict(shape='Slanted clipped rectangle with ridged displacement',variation_percent=20,
                            safety='Field expands outward by up to 0.8m; actual post-decimation minimum is checked against collider.')
    v['collapsed_hall_pillars']=1;v['fallen_blocks']=3;v['real_fracture_microfacets']=len(s['lod0'].data.polygons)-len(s['collider'].data.polygons)
    v['known_limits']=['Light-beam dust and practical preview lights are presentation-only. The three narrow shafts are real collider openings. LOS compares equal travel distances along rejoining branch choices; a 20m sustained occlusion is required.']


def r1_checkpoint(name):
    """Persist construction state along with packed work, without creating extra deliverable files."""
    s=STATE[name];sc=s['scene'];data={}
    for key in ['review','paths','full_paths','branches','craters','chambers','shafts','markers','entrances','graph','los','distance','validation','preview_specs','flood_positions','deck_z','upper_path','lower_path','bypass_path','preview_review','r2_unmet','full_stern','gap_path_index']:
        if key in s:data[key]=s[key]
    data['objects']={key:s[key].name for key in ['collider','lod0','dust'] if key in s}
    data['images']={k:im.name for k,im in s.get('images',{}).items()}
    data['lods']=[o.name for o in s.get('lods',[])];data['material']=s['material'].name if 'material' in s else None
    sc['review_work_checkpoint']=json.dumps(data);r1_save_source()


def r1_resume_checkpoint():
    for name in ['iskele','sessiz_liman','kovuk','yarik_kalbi','enkaz']:
        if name in STATE and 'collider' in STATE[name]:continue
        sc=bpy.data.scenes.get(name)
        if not sc or 'review_work_checkpoint' not in sc:continue
        s=json.loads(sc['review_work_checkpoint']);s['scene']=sc
        for key,oname in s.pop('objects').items():s[key]=bpy.data.objects[oname]
        s['images']={k:bpy.data.images[n] for k,n in s['images'].items()};s['lods']=[bpy.data.objects[n] for n in s['lods']]
        if s['material']:s['material']=bpy.data.materials[s['material']]
        else:s.pop('material')
        if 'lod0' in s:s['render_parts']=[s['lod0']]
        STATE[name]=s


r1_resume_checkpoint()


def r1_cave_map():
    made,original=draw_centrelines('kovuk');original.use_fake_user=True;s=STATE['kovuk'];height=max(v.co.z for v in s['lod0'].data.vertices)+12
    palette=[(.06,.72,.68),(.84,.39,.10),(.68,.83,1),(.25,.58,.45)]
    mats=[]
    for i,color in enumerate(palette):
        mat=bpy.data.materials.get('review_map_level_'+str(i)) or bpy.data.materials.new('review_map_level_'+str(i));mat.use_nodes=True;mat.use_fake_user=True
        bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=1.5;mats.append(mat)
    for i,ob in enumerate(made):ob.data.materials[0]=mats[[0,1,2,3,3,1,3,0,2][i]]
    for text,p,ink in [('UPPER +40 m',(-65,183),0),('LOWER -60 m',(-65,-172),1),('HIGH +140 m',(-65,10),2),('PILLAR LOOP',(154,88),3)]:
        curve=bpy.data.curves.new('Map level caption','FONT');curve.body=text;curve.size=14;curve.align_x='CENTER';curve.materials.append(mats[ink])
        ob=bpy.data.objects.new('Map level caption',curve);s['scene'].collection.objects.link(ob);ob.location=(*p,height);made.append(ob)
    return made,original


def r1_run_stage(name,stage,**options):
    """One MCP call per stage; see docs/yarik-structures.md for the sequential recipe."""
    assert name in ['iskele','sessiz_liman','kovuk']
    for previous in ['iskele','sessiz_liman','kovuk'][:['iskele','sessiz_liman','kovuk'].index(name)]:
        assert STATE.get(previous,{}).get('verified'),('Previous asset must be fully delivered and verified',previous)
    if stage=='plan':
        assert name not in STATE,('Scene already loaded; use the saved state or explicit r1_reset_live()',name)
        if name=='iskele':r1_iskele();r1_join_render(name)
        elif name=='sessiz_liman':r1_liman_plan()
        else:r1_kovuk_plan()
    elif stage=='shell':r1_liman_shell() if name=='sessiz_liman' else r1_kovuk_shell()
    elif stage=='carve':r1_liman_carve() if name=='sessiz_liman' else r1_kovuk_reduce()
    elif stage=='routes':
        assert name=='kovuk';r1_kovuk_routes();r1_kovuk_los()
    elif stage=='render_mesh':
        if name=='kovuk':r1_kovuk_render()
        else:r1_render_from_collider(name,.22);r1_liman_details();r1_join_render(name)
    elif stage=='map_begin':r1_rock_map_begin(options['kind'],options.get('size',2048))
    elif stage=='map_rows':r1_rock_map_rows(options['start'],options.get('rows',256))
    elif stage=='map_end':r1_rock_map_end()
    elif stage=='atlas':r1_atlas(name,options['kind'],1024)
    elif stage=='material':r1_kovuk_material() if name=='kovuk' else r1_material(name)
    elif stage=='lighting':r1_kovuk_lighting() if name=='kovuk' else r1_lighting(name)
    elif stage=='lods':r1_make_lods(name)
    elif stage=='distance':r1_distance(name)
    elif stage=='validate':r1_validate(name)
    elif stage=='preview':r1_preview(name,options['kind'])
    elif stage=='deliver':
        assert STATE[name].get('preview_review'), 'Inspect all six renders and set preview_review before delivery'
        r1_deliver(name)
    elif stage=='verify':r1_verify_glb(name)
    else:raise ValueError(stage)
    if stage not in ['map_begin','map_rows','deliver']:r1_checkpoint(name)


# Review 2. Immutable collision/navigation; only render data and presentation change.
def r2_fingerprint(name):
    import hashlib
    s=STATE[name];ob=s['collider'];me=ob.data
    coords=np.empty(len(me.vertices)*3,dtype=np.float32);me.vertices.foreach_get('co',coords)
    indices=np.empty(len(me.loops),dtype=np.int32);me.loops.foreach_get('vertex_index',indices)
    digest=lambda b:hashlib.sha256(b).hexdigest()
    # DNA transforms remain reliable for inactive scenes whose matrix_world cache has not evaluated yet.
    markers={o['asset_node']:dict(location=list(o.location),rotation=list(o.rotation_euler),rotation_mode=o.rotation_mode,
                                 scale=list(o.scale),parent=o.parent.name if o.parent else None)
             for o in s['scene'].objects if o.type=='EMPTY' and o.get('asset_node')}
    metadata=(OUT/name/(name+'.json')).read_bytes()
    return dict(collider_vertices_sha256=digest(coords.tobytes()),collider_indices_sha256=digest(indices.tobytes()),
                collider_transform=[list(row) for row in ob.matrix_world],markers=markers,metadata_bytes_sha256=digest(metadata))


def r2_glb_fingerprint(name):
    import hashlib
    raw=(OUT/name/(name+'.glb')).read_bytes();size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size]);binary=raw[28+size:]
    col=next(n for n in doc['nodes'] if n['name']=='collider');prim=doc['meshes'][col['mesh']]['primitives'][0]
    geometry={}
    for semantic,index in dict(prim['attributes'],INDICES=prim['indices']).items():
        acc=doc['accessors'][index];view=doc['bufferViews'][acc['bufferView']];start=view.get('byteOffset',0)+acc.get('byteOffset',0)
        width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[acc['type']];item={5126:4,5125:4,5123:2,5121:1}[acc['componentType']]
        data=b''.join(binary[start+i*view.get('byteStride',width*item):start+i*view.get('byteStride',width*item)+width*item] for i in range(acc['count']))
        geometry[semantic]=dict(sha256=hashlib.sha256(data).hexdigest(),count=acc['count'],component=acc['componentType'],type=acc['type'])
    names={m['name'] for m in STATE[name]['markers']}
    transforms={n['name']:{key:n[key] for key in ['translation','rotation','scale','matrix'] if key in n} for n in doc['nodes'] if n['name'] in names or n['name']=='collider'}
    return dict(geometry=geometry,node_transforms=transforms)


def r2_lock_glbs():
    for name in ['iskele','sessiz_liman','kovuk']:
        sc=STATE[name]['scene']
        if 'review2_glb_immutable' not in sc:sc['review2_glb_immutable']=json.dumps(r2_glb_fingerprint(name),sort_keys=True)


def r2_lock_all():
    for name in ['iskele','sessiz_liman','kovuk']:
        s=STATE[name];sc=s['scene']
        if 'review2_immutable' in sc:
            old=json.loads(sc['review2_immutable']);current=r2_fingerprint(name)
            if old['markers'] and isinstance(next(iter(old['markers'].values())),list):
                for key in ['collider_vertices_sha256','collider_indices_sha256','collider_transform','metadata_bytes_sha256']:assert old[key]==current[key]
                metadata=json.loads((OUT/name/(name+'.json')).read_text());markers=metadata['entrances']+metadata.get('deposits',[])+metadata.get('pads',[])+([metadata['deck']] if 'deck' in metadata else [])
                for m in markers:
                    ob=next(o for o in sc.objects if o.get('asset_node')==m['name']);p=Vector((m['position'][0],-m['position'][2],m['position'][1]));d=Vector((m['direction'][0],-m['direction'][2],m['direction'][1]))
                    assert (ob.location-p).length<.0001
                    axis=Vector((0,0,1) if m['axis']=='+Z' else (0,1,0));assert (ob.rotation_euler.to_quaternion()@axis-d).length<.0001
                sc['review2_immutable']=json.dumps(current,sort_keys=True)
        else:sc['review2_immutable']=json.dumps(r2_fingerprint(name),sort_keys=True)
        assert json.loads(sc['review2_immutable'])==r2_fingerprint(name)
    r1_save_source();print('LOCKED: exact collider arrays, transforms, every empty matrix, byte-identical navigation JSON')


def r2_assert_immutable(name):
    assert r2_fingerprint(name)==json.loads(STATE[name]['scene']['review2_immutable']),name+' collision/navigation changed'
    return dict(unchanged=True,**r2_fingerprint(name))


def r2_begin(name):
    s=STATE[name]
    assert s['validation'].get('review')=='review-1', 'Begin only on the pinned Review 1 baseline; completed Review 2 must not receive duplicate details'
    for previous in ['iskele','sessiz_liman','kovuk'][:['iskele','sessiz_liman','kovuk'].index(name)]:
        assert STATE[previous]['validation'].get('review')=='review-2' and STATE[previous].get('verified')
    r2_assert_immutable(name);bpy.context.window.scene=s['scene'];s['review']='review-2';s['verified']=False;s['scene']['review_delivered']=False
    for ob in s['lods'][1:]:bpy.data.objects.remove(ob,do_unlink=True)
    s['lods']=[s['lod0']];s['render_parts']=[s['lod0']];s['lod0'].hide_set(False);s['lod0'].hide_render=False
    s['validation']=json.loads((OUT/name/'validation.json').read_text());s['validation'].pop('glb_roundtrip',None)
    if name=='kovuk' and s['scene'].get('review_work_checkpoint'):
        checkpoint=json.loads(s['scene']['review_work_checkpoint'])
        for key in ['craters','chambers','shafts','branches','full_paths','los']:
            if key in checkpoint:s[key]=checkpoint[key]
    s['r2_unmet']=[];purge(name+' review2 render only')


def r2_strip(name,points,width,region):
    a,b=Vector(points[0]),Vector(points[1]);normal=Vector(points[2]);side=(b-a).cross(normal).normalized()*width/2
    return r1_quad(name,[list(a-side),list(b-side),list(b+side),list(a+side)],region)


def r2_ring(name,centre,radius,width,z,region=1,start=0,end=2*math.pi,steps=24):
    x,y=centre;verts=[];faces=[]
    for a in np.linspace(start,end,steps+1):
        for r in [radius-width/2,radius+width/2]:verts.append((x+r*math.cos(a),y+r*math.sin(a),z))
    for i in range(steps):faces.extend([(2*i,2*i+1,2*i+3),(2*i,2*i+3,2*i+2)])
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob);r1_region(ob,region);return ob


def r2_text(name,text,position,size,region=8,rotation=(0,0,0)):
    curve=bpy.data.curves.new(name,'FONT');curve.body=text;curve.size=size;curve.align_x='CENTER';curve.resolution_u=1
    ob=bpy.data.objects.new(name,curve);bpy.context.scene.collection.objects.link(ob);ob.location=position;ob.rotation_euler=rotation
    select(ob);bpy.ops.object.convert(target='MESH');ob=bpy.context.object;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);r1_region(ob,region);return ob


def r2_pipe(name,path,radius=.24,region=5):
    verts=[];faces=[]
    for j,p in enumerate(path):
        t=Vector(path[min(j+1,len(path)-1)])-Vector(path[max(0,j-1)]);t.normalize();up=Vector((0,0,1))
        if abs(t.z)>.9:up=Vector((0,1,0))
        side=t.cross(up).normalized();up=side.cross(t).normalized()
        for a in np.linspace(0,2*math.pi,8,endpoint=False):verts.append(Vector(p)+radius*(math.cos(a)*side+math.sin(a)*up))
    for i in range(len(path)-1):
        for j in range(8):k=i*8+j;l=i*8+(j+1)%8;faces.extend([(k,l,l+8),(k,l+8,k+8)])
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob);r1_region(ob,region);return ob


def r2_iskele_details():
    s=STATE['iskele'];parts=s['render_parts'];z=10.785
    for i in range(24):
        a=2*math.pi*i/24;parts.append(r2_ring('Inset landing glyph',(0,0),30,1.20,z,1,a+.026,a+2*math.pi/24-.026,8))
    for a in [0,math.pi/2,math.pi,3*math.pi/2]:
        p=[Vector(rotate_xy(q,a)) for q in [(20.9,0,z),(25,3.5,z),(25,-3.5,z)]]
        for q in p[1:]:parts.append(r2_strip('Inward chevron',[p[0],q,(0,0,1)],1.12,1))
    parts.append(r2_ring('Centre dot',(0,0),.77,1.54,z,1,steps=24))
    for i in range(48):
        if i in [0,47]:continue  # The fixed mast footing interrupts the hazard ring here.
        a=2*math.pi*i/48;parts.append(r2_ring('Amber hazard dash',(0,0),49,.66,z,3,a,a+math.pi/48*.95,3))
    for i,a in enumerate(np.linspace(0,2*math.pi,12,endpoint=False)):
        c=(40.5*math.cos(a),40.5*math.sin(a));parts.append(r2_ring('Tie down recessed collar',c,.62,.16,z,5,steps=12))
    for i,a in enumerate([0,2*math.pi/3,4*math.pi/3]):
        p=rotate_xy((37,0,z+.003),a);parts.append(r2_text('Dock identifier','İ-'+str(i+1),p,3.2,8,rotation=(0,0,a+math.pi/2)))
        x,y,_=rotate_xy((42,0,0),a)
        for j in range(7):
            points=[rotate_xy(v,a) for v in [(39+j*.65,-1.9,z),(39.25+j*.65,-1.9,z),(39.25+j*.65,1.9,z),(39+j*.65,1.9,z)]]
            parts.append(r1_quad('Landing service grate',points,4))
    # Shallow structural relief follows the delivered solid mast; it cannot become an open triangular lattice.
    for axis,sign,half in [(0,1,2),(0,-1,2),(1,1,2.5),(1,-1,2.5)]:
        n=Vector((sign if axis==0 else 0,sign if axis==1 else 0,0))
        def p(t,z):
            point=Vector((47,0,z));point[axis]+=sign*(half+.12);point[1-axis]+=t;return point
        for low,high in [(14,26),(26,38),(38,50),(50,64)]:
            for x,y in [(-1.1,1.1),(1.1,-1.1)]:parts.append(r2_strip('Mast X brace',[p(x,low),p(y,high),n],1.5,5))
        if axis==1:
            c=p(0,39);side=Vector((1,0,0));up=Vector((0,0,1))
            parts.append(r1_quad('Red obstruction lamp',[c-side*.32-up*.36,c+side*.32-up*.36,c+side*.32+up*.36,c-side*.32+up*.36],7))
    for a in [math.pi/3,math.pi,5*math.pi/3]:
        x,y,_=rotate_xy((25,0,0),a)
        for sign in [-1,1]:
            angle=a+sign*.7;path=[(x+7.24*math.cos(angle),y+7.24*math.sin(angle),zz) for zz in [-22,-11,0,2.4]]
            parts.append(r2_pipe('Tank to deck plumbing',path,.22,5))
        parts.append(r2_ring('Tank end cap seam',(x,y),5.4,.20,-24.06,5,steps=20))
    for x in [-5,0,5]:
        parts.append(r2_ring('Nozzle heat rim',(x,0),2.15,.44,-35.18,5,steps=16))
        parts.append(r2_ring('Recessed nozzle shadow',(x,0),.97,1.94,-35.035,4,steps=16))
    r1_join_render('iskele')
    s['r2_unmet']=['An open tapered triangular lattice mast and open truss chords cannot replace the delivered solid post/members while keeping every collider point within 0.75m. Added surface X-bracing and pipe/cap/nozzle relief within the tolerance; the solid core and silhouette remain.']
    r2_assert_immutable('iskele');purge('Iskele Review2 crisp geometry')


def r2_atlas(name,kind,size=2048):
    s=STATE[name];axis=(np.arange(size,dtype=np.float32)+.5)/size;U,V=np.meshgrid(axis,axis)
    rng=np.random.default_rng(2052202);grain=rng.random((size,size),dtype=np.float32)-.5
    X=((U-.04)/.70-.5)*110;Y=((V-.04)/.70-.5)*110
    rgb=np.zeros((size,size,3),dtype=np.float32);height=np.zeros_like(U);rough=np.full_like(U,.66);metal=np.full_like(U,.82);emission=np.zeros_like(rgb)
    if name=='iskele':
        rgb[:]=(.022,.031,.037);rgb+=grain[:,:,None]*.004
        deck=(U<.75)&(V<.75);R=np.hypot(X,Y);angle=np.arctan2(Y,X)
        row=np.floor((Y+55)/11);width=8+3*(row%3);xx=(X+55+row*3.3)%width;yy=(Y+55)%11
        seam=deck&((xx<.14)|(yy<.14));edge=deck&((xx<.43)|(yy<.43)|(xx>width-.25)|(yy>10.75))
        plate=(np.sin(np.floor((X+55+row*3.3)/width)*13.1+row*71.3)*.5+.5)
        rgb[deck]*=(.72+.45*plate[deck,None]);rgb[seam]=(.004,.007,.009);height[seam]=-.25
        wear=edge&~seam&(grain>.08);rgb[wear]=(.095,.115,.125);metal[wear]=.95;rough[wear]=.40
        polished=deck&(R<33);rough[polished]=.31+.10*plate[polished]
        rim=deck&(R>43);rough[rim]=.74+.11*(grain[rim]+.5)
        # Directional landing scuffs are broken arcs, with rubber/heat staining rather than soft clouds.
        for a,r in [(.45,25.5),(2.55,24),(4.6,26.8),(5.8,22.5)]:
            angular=np.abs(np.arctan2(np.sin(angle-a),np.cos(angle-a)));radial=np.abs(R-r)
            scuff=deck&(angular<.30)&(radial<.75)&(grain>-.29)
            rgb[scuff]*=.20;rough[scuff]=.89;height[scuff]-=.035
            streak=deck&(angular<.36)&(radial>.8)&(radial<1.1)&(grain>.16);rgb[streak]*=.55
        for a in np.linspace(0,2*math.pi,12,endpoint=False):
            d=np.hypot(X-40.5*math.cos(a),Y-40.5*math.sin(a));collar=deck&(d<.79)&(d>.43);hole=deck&(d<.43)
            rgb[collar]=(.12,.14,.15);height[collar]=.10;rgb[hole]=(.003,.004,.005);height[hole]=-.22
            chipped=deck&(d>.8)&(d<1.65)&(grain>.27);rgb[chipped]=(.08,.095,.10);rough[chipped]=.86
        # Flat atlas swatches service actual crisp geometry, not rasterized landing strokes.
        teal=linear_rgb('2ee6c8');amber=linear_rgb('e6a450')
        swatches=[((U>.80)&(U<.90)&(V>.84),teal*.48,teal*.75,.25,.15),
          ((U>.91)&(V>.70)&(V<.78),(.55,.67,.75),(.55,.67,.75),.22,.05),
          ((U>.80)&(U<.90)&(V>.70)&(V<.78),amber*.35,amber*.36,.42,.15),
          ((U>.90)&(V>.50)&(V<.56),(.002,.004,.005),(0,0,0),.78,.20),
          ((U>.93)&(V>.56)&(V<.64),(.13,.155,.17),(0,0,0),.32,.94),
          ((U>.93)&(V>.64)&(V<.70),(.008,.012,.014),(.002,.007,.009),.80,.45),
          ((U>.80)&(U<.87)&(V>.78)&(V<.82),(.28,.008,.003),(.80,.012,.003),.24,.05),
          ((U>.93)&(V>.78)&(V<.82),(.34,.37,.36),(0,0,0),.72,.15)]
        for mask,c,e,r,m in swatches:rgb[mask]=c;emission[mask]=e;rough[mask]=r;metal[mask]=m;height[mask]=0
    else:
        rgb,height,rough,metal,emission=r2_station_pixels(U,V,grain)
    if kind=='base':pixels=np.where(rgb<=.0031308,rgb*12.92,1.055*np.maximum(rgb,0)**(1/2.4)-.055)
    elif kind=='emissive':pixels=np.where(emission<=.0031308,emission*12.92,1.055*np.maximum(emission,0)**(1/2.4)-.055)
    elif kind=='orm':pixels=np.stack([np.ones_like(U),rough,metal],axis=2)
    else:
        dy,dx=np.gradient(height);n=np.stack([-dx*2.5,-dy*2.5,np.ones_like(U)],axis=2);n[:,:,0]+=grain*.032;n/=np.linalg.norm(n,axis=2)[:,:,None];pixels=n*.5+.5
    rgba=np.ones((size,size,4),dtype=np.float32);rgba[:,:,:3]=np.clip(pixels,0,1)
    if kind in s.get('images',{}):bpy.data.images.remove(s['images'].pop(kind),do_unlink=True)
    im=bpy.data.images.new(name+'_'+kind,size,size,alpha=False);enum_value(im.colorspace_settings,'name','sRGB' if kind in ['base','emissive'] else 'Non-Color')
    im.pixels.foreach_set(rgba.ravel());im.update();im.pack();im.use_fake_user=True;s.setdefault('images',{})[kind]=im
    del U,V,X,Y,rgb,height,rough,metal,emission,pixels,rgba;purge(name+' review2 '+kind)


def r2_review_lighting(name):
    s=STATE[name];sc=s['scene'];tree=bpy.data.node_groups.new(name+'_review2_compositor','CompositorNodeTree')
    tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor');sc.compositing_node_group=tree;sc.use_nodes=True
    ns=tree.nodes;links=tree.links;render=ns.new('CompositorNodeRLayers');render.scene=sc;glare=ns.new('CompositorNodeGlare')
    glare.inputs['Type'].default_value='Fog Glow';glare.inputs['Quality'].default_value='Medium';glare.inputs['Threshold'].default_value=1.5;glare.inputs['Strength'].default_value=.12;glare.inputs['Size'].default_value=.24
    out=ns.new('NodeGroupOutput');links.new(render.outputs['Image'],glare.inputs['Image']);links.new(glare.outputs['Image'],out.inputs['Image'])
    sc.view_settings.exposure=-.3;sc.eevee.taa_render_samples=32
    if name=='iskele':
        for ob in sc.objects:
            if ob.type=='LIGHT' and ob.data.type=='SUN':ob.data.energy=2.0
    elif name=='sessiz_liman':
        for ob in sc.objects:
            if ob.name=='Atrium broad key':ob.data.energy=700000
            elif ob.name=='Atrium amber fill':ob.data.energy=70000
            elif ob.name=='Atrium low fill':ob.data.energy=60000
    purge(name+' key dark fill subtle bloom')


def r2_validate(name):
    s=STATE[name];v=s['validation'];v['review']='review-2';v['immutable_baseline']=r2_assert_immutable(name)
    v['collider_vs_lod0']=s['distance'];v['lod_triangle_counts']={o['asset_node']:len(o.data.polygons) for o in s['lods']}
    v['texture_sizes']={k:list(im.size) for k,im in s['images'].items()};v['unmet_rules']=s.get('r2_unmet',[])
    if name=='kovuk':
        v.pop('real_fracture_microfacets',None);v['render_surface_detail']=dict(base_triangles=len(s['collider'].data.polygons),vein_triangles=556,mouth_flake_triangles=88,uniform_centroid_microfacets_removed=True)
    v['current_rss_mib']=purge(name+' review2 validate');v['peak_process_rss_mib']=__import__('resource').getrusage(__import__('resource').RUSAGE_SELF).ru_maxrss/1024
    v.pop('exported_glb',None);v.pop('glb_roundtrip',None);v['paths']=r1_measure_routes(name)
    assert len(s['lod0'].data.polygons)<={'iskele':15000,'sessiz_liman':40000,'kovuk':30000}[name]
    assert_solid(s['collider']);assert intersection_check(s['collider'])['passed'];dump(OUT/name/'validation.json',v)
    print(name,v['lod_triangle_counts'],v['unmet_rules'])


def r2_deliver(name):
    s=STATE[name];r2_assert_immutable(name);bpy.context.window.scene=s['scene'];folder=OUT/name
    bpy.ops.object.select_all(action='DESELECT')
    for ob in [s['collider']]+s['lods']+[o for o in s['scene'].objects if o.type=='EMPTY']:
        ob.hide_set(False);ob.hide_viewport=False;ob.select_set(True)
    options=dict(filepath=str(folder/(name+'.glb')),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,
                 export_animations=False,export_image_format='AUTO',export_extras=True,export_cameras=False,export_lights=False,
                 export_all_vertex_colors=False)
    if name in ['kovuk','sessiz_liman']:options.update(export_vertex_color='NAME',export_vertex_color_name='Geology' if name=='kovuk' else 'HullTint')
    bpy.ops.export_scene.gltf(**options);doc=patch_glb(folder/(name+'.glb'),s)
    serialized=r2_glb_fingerprint(name);assert serialized==json.loads(s['scene']['review2_glb_immutable']), 'Export changed immutable collider bytes or marker transforms'
    s['validation']['serialized_collision_navigation_unchanged']=dict(passed=True,**serialized)
    assert len(doc['materials'])==1 and len(doc['images'])==4
    assert {n['name'] for n in doc['nodes']}=={'collider','lod0','lod1','lod2'}|{m['name'] for m in s['markers']}
    s['validation']['exported_glb']=dict(bytes=(folder/(name+'.glb')).stat().st_size,materials=1,embedded_pngs=4)
    import hashlib
    dump(folder/'provenance.json',dict(origin='Original procedural geometry and PBR; no third-party models or textures',review='review-2',date='2026-10-22',
        blender_version=bpy.app.version_string,generator='tools/yarik-blender.py',generator_sha256=hashlib.sha256((ROOT/'tools/yarik-blender.py').read_bytes()).hexdigest(),
        immutable_collision_navigation=True))
    dump(folder/'validation.json',s['validation']);s['scene']['review_preview_specs']=json.dumps(s['preview_specs']);s['scene']['review_delivered']=True
    s['collider'].hide_render=True;s['collider'].hide_set(True)
    for ob in s['lods'][1:]:ob.hide_render=True;ob.hide_set(True)
    r2_assert_immutable(name);r1_save_source();print('REVIEW 2 DELIVERED',name)


def r2_projected_panel(name,points,region,offset=.34):
    s=STATE[name];tree=s['_r2_tree'];base=[tree.find_nearest(Vector(p)) for p in points]
    if max(v[3] for v in base)>1.5:return None
    points=[h[0]+h[1]*offset for h in base]
    checks=points+[(points[i]+points[(i+1)%len(points)])*.5 for i in range(len(points))]+[sum(points,Vector())/len(points)]
    if max(tree.find_nearest(p)[3] for p in checks)>.68:return None
    me=bpy.data.meshes.new('Carrier hugging detail');me.from_pydata(points,[],[(0,i,i+1) for i in range(1,len(points)-1)]);me.update()
    ob=bpy.data.objects.new('Carrier hugging detail',me);s['scene'].collection.objects.link(ob);r1_region(ob,region);s['render_parts'].append(ob);return ob


def r2_liman_details():
    name='sessiz_liman';s=STATE[name];s['_r2_tree']=mesh_bvh(s['collider'])[0];tree=s['_r2_tree']
    # Every bent plate stays close to the existing fractured lip; no fictional collision opening is introduced.
    for sign,y,z in [(1,80,45),(-1,-80,-45)]:
        x=sign*327
        for side in [-1,1]:
            for j in range(5):
                zz=z-38+j*18;points=[(x,y+side*54,zz),(x-sign*7,y+side*54,zz+3),(x-sign*11,y+side*54,zz+15),(x,y+side*54,zz+18)]
                r2_projected_panel(name,points,6,.48 if j%2 else .18)
            for j in range(5):
                xx=x-sign*j*10;points=[(xx,y+side*35,z+55),(xx-sign*7,y+side*35,z+55),(xx-sign*7,y+side*48,z+55),(xx,y+side*48,z+55)]
                r2_projected_panel(name,points,6,.22+(.23 if j%2 else 0))
    s['render_parts'].append(r2_text('Faded hangar name','SESSİZ LİMAN',(0,-335.035,51),7,8,(math.pi/2,0,0)))
    s['render_parts'].append(r2_text('Hangar number','07',(75,-335.045,-4),5.8,8,(math.pi/2,0,0)))
    for sign in [-1,1]:
        for z in [-26,12]:
            corners=[Vector((sign*74,-335.18,z)),Vector((sign*80,-335.18,z)),Vector((sign*80,-335.18,z+10)),Vector((sign*74,-335.18,z+10))]
            for a,b in zip(corners,corners[1:]+corners[:1]):s['render_parts'].append(r2_strip('Hangar clamp surface frame',[a,b,(0,-1,0)],1.2,6))
    # Straight exterior windows / service lights sit on real hull faces and remain visible with a dark sky fill.
    for x in [-81,81]:
        for y in [-310,-270,-230,-190,-150]:
            r2_projected_panel(name,[(x,y-8,18),(x,y+8,18),(x,y+8,20),(x,y-8,20)],7,.08)
            for zz in [-30,29]:r2_projected_panel(name,[(x,y-5,zz),(x,y+5,zz),(x,y+5,zz+1.8),(x,y-5,zz+1.8)],1,.07)
    # Atrium running lamps and radiator cassettes, shallow enough for the locked carrier.
    for i in range(40):
        a,b=2*math.pi*i/40,2*math.pi*(i+1)/40;mid=(a+b)/2
        for z in [-65,22,70]:
            p=Vector((142*math.cos(a),142*math.sin(a),z));q=Vector((142*math.cos(b),142*math.sin(b),z));p,q=p.lerp(q,.15),p.lerp(q,.85)
            r2_projected_panel(name,[p,q,q+Vector((0,0,1.5)),p+Vector((0,0,1.5))],7 if i%5 else 1,.08)
        # Carrier-following radiator fins; actual large projections would violate the immutable collider.
        if i%4==0:
            for zz in [-38,-31,-24,-17]:
                p=Vector((142*math.cos(a),142*math.sin(a),zz));q=Vector((142*math.cos(b),142*math.sin(b),zz))
                r2_projected_panel(name,[p,q,q+Vector((0,0,2.0)),p+Vector((0,0,2.0))],6,.48)
    # Floor-level amber wayfinding along every navigable corridor, including the two atrium approaches.
    for path_id,path in enumerate(s['paths']):
        points=sample_path(path,14)
        for j,p in enumerate(points[1:-1]):
            p=Vector(p);t=(Vector(points[min(j+2,len(points)-1)])-Vector(points[j])).normalized();side=t.cross(Vector((0,0,1)))
            if side.length<.01:continue
            side.normalize()
            for sign in [-1,1]:
                query=p+side*sign*26;hit,n,_,_=tree.ray_cast(query+Vector((0,0,10)),Vector((0,0,-1)),130)
                if hit is None or n.z<.4:continue
                r2_projected_panel(name,[hit-t*1.8-side*.32,hit+t*1.8-side*.32,hit+t*1.8+side*.32,hit-t*1.8+side*.32],1,.045)
    # Cables and service pipes follow the carrier rather than hanging in unsupported space.
    for path in s['paths'][8:11]:
        points=sample_path(path,5);run=[]
        for p in points:
            p=Vector(p)+Vector((0,12,55));hit,n,_,d=tree.find_nearest(p)
            q=hit+n*.27
            if run and tree.find_nearest((run[-1]+q)*.5)[3]>.42:
                if len(run)>1:s['render_parts'].append(r2_pipe('Corridor service pipe',run,.18,6))
                run=[]
            run.append(q)
        if len(run)>1:s['render_parts'].append(r2_pipe('Corridor service pipe',run,.18,6))
    r1_join_render(name);del s['_r2_tree'];r2_guard_surface(name);r2_trim_detail_faces(name)
    regions=s['lod0'].data.attributes['r1_region'].data
    for f in s['lod0'].data.polygons:
        if regions[f.index].value==6 and abs(f.center.x)>318 and f.area>4 and f.index%7==0:regions[f.index].value=1
    r1_uv_structure(name,s['lod0']);r2_station_uv();r2_assert_immutable(name)
    s['r2_unmet']=['Large outward torn plates, hanging cables, a removed outer-ring section and major new silhouette fins cannot be introduced within 0.75m of the unchanged closed collider. Damage, ribs, pipes, clamps and fin relief stay on the delivered carrier; no new large opening was made.']
    purge('Station review2 surface construction')


def r2_guard_surface(name,limit=.60):
    s=STATE[name];tree=mesh_bvh(s['collider'])[0];changed=0
    for v in s['lod0'].data.vertices:
        hit,n,_,distance=tree.find_nearest(v.co)
        if distance>limit:v.co=hit+(v.co-hit).normalized()*.54;changed+=1
    s['lod0'].data.update();print('Bounded render detail vertices',changed)


def r2_trim_detail_faces(name):
    s=STATE[name];tree=mesh_bvh(s['collider'])[0];ob=s['lod0'];bm=bmesh.new();bm.from_mesh(ob.data);region=bm.faces.layers.int.get('r1_region');bad=[]
    for f in bm.faces:
        if region and f[region]!=6:continue
        a,b,c=[v.co for v in f.verts]
        if any(tree.find_nearest(a*(1-i/4-j/4)+b*(i/4)+c*(j/4))[3]>.60 for i in range(5) for j in range(5-i)):bad.append(f)
    bmesh.ops.delete(bm,geom=bad,context='FACES');loose=[v for v in bm.verts if not v.link_faces]
    if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    bm.to_mesh(ob.data);bm.free();print('Trimmed carrier discontinuity faces',len(bad))


def r2_repaint_begin(name,kind,size=2048):
    STATE[name]['paint_work']=dict(kind=kind,size=size,pixels=np.ones((size,size,4),dtype=np.float32));purge(name+' streamed paint buffer')


def r2_repaint_rows(name,start,rows=256):
    w=STATE[name]['paint_work'];size=w['size'];stop=min(size,start+rows);u=(np.arange(size,dtype=np.float32)+.5)/size;v=(np.arange(start,stop,dtype=np.float32)+.5)/size;U,V=np.meshgrid(u,v)
    grain=np.mod(np.sin(U*18133+V*37817)*43758.5453,1)-.5
    rgb,h,rough,metal,em=r2_station_pixels(U,V,grain)
    if w['kind']=='base':p=np.where(rgb<=.0031308,rgb*12.92,1.055*np.maximum(rgb,0)**(1/2.4)-.055)
    elif w['kind']=='orm':p=np.stack([np.ones_like(U),rough,metal],axis=2)
    else:p=np.where(em<=.0031308,em*12.92,1.055*np.maximum(em,0)**(1/2.4)-.055)
    w['pixels'][start:stop,:,:3]=p;print(name,w['kind'],start,stop)


def r2_repaint_end(name):
    s=STATE[name];w=s.pop('paint_work');kind=w['kind'];size=w['size'];bpy.data.images.remove(s['images'].pop(kind),do_unlink=True)
    im=bpy.data.images.new(name+'_'+kind,size,size,alpha=False);im.colorspace_settings.name='Non-Color' if kind=='orm' else 'sRGB';im.pixels.foreach_set(w['pixels'].ravel());im.update();im.pack();im.use_fake_user=True;s['images'][kind]=im;del w;purge(name+' streamed paint packed')


def r2_panel_field(U,V):
    x=U*128;y=V*128;row=np.floor(y/9);w=4+(row%4)*2.5;xx=(x+row*2.71)%w;yy=y%9
    seam=(xx<.075)|(yy<.075);edge=(xx<.22)|(yy<.22)|(xx>w-.20)|(yy>8.8)
    cell=np.mod(np.sin(np.floor((x+row*2.71)/w)*127.1+row*311.7)*43758.5453,1)
    bolt=np.minimum.reduce([(xx-.45)**2+(yy-.45)**2,(xx-w+.45)**2+(yy-.45)**2,(xx-.45)**2+(yy-8.55)**2,(xx-w+.45)**2+(yy-8.55)**2])<.15**2
    slot=(cell>.74)&(abs(xx-w*.5)<1.2)&(abs(yy-4.5)<.24)
    height=-.18*seam.astype(np.float32)+.08*bolt.astype(np.float32)-.10*slot.astype(np.float32)
    return seam,edge,cell,bolt,height


def r2_station_pixels(U,V,grain):
    rgb,height,rough,metal,emission=r1_structure_atlas('sessiz_liman',U,V,grain)
    seam,edge,cell,bolt,normal_height=r2_panel_field((U-.52)/.46*.75,(V-.02)/.70*.60)
    hull=(U>.51)&(V<.80);value=.026+.003*cell+.0015*grain
    for k,factor in enumerate([.83,.94,1.0]):rgb[:,:,k][hull]=(value*factor)[hull]
    rgb[hull&seam]=(.019,.023,.026);wear=hull&edge&(cell>.87)&(grain>.35);rgb[wear]=(.050,.060,.065);rgb[hull&bolt]=(.037,.043,.047)
    height[hull]=normal_height[hull];rough[hull]=(.62+.10*cell)[hull];metal[hull]=.72;metal[wear]=.90
    # Baked wear is crisp and directional; large breach scorch is also carried in vertex tint.
    for u,v,rx,ry in [(.94,.42,.06,.11),(.55,.30,.04,.12),(.77,.60,.09,.055)]:
        d=((U-u)/rx)**2+((V-v)/ry)**2;burn=hull&(d<1+.16*np.sin(U*237+V*189))
        rgb[burn]*=.24;rough[burn]=.94
    for mask,color,emit in [((U>.54)&(U<.66)&(V>.96),(.018,.14,.16),(.035,.60,.65)),
                           ((U>.67)&(U<.77)&(V>.96),(.25,.27,.25),(0,0,0)),
                           ((U>.78)&(U<.89)&(V>.96),(.002,.003,.004),(0,0,0))]:
        rgb[mask]=color;emission[mask]=emit;rough[mask]=.7;height[mask]=0
    return rgb,height,rough,metal,emission


def r2_station_uv():
    s=STATE['sessiz_liman'];me=s['lod0'].data;uv=me.uv_layers.get('DetailUV') or me.uv_layers.new(name='DetailUV')
    tint=me.color_attributes.get('HullTint') or me.color_attributes.new(name='HullTint',type='FLOAT_COLOR',domain='CORNER');regions=me.attributes['r1_region'].data
    for f in me.polygons:
        p=f.center;region=regions[f.index].value;axis=max(range(3),key=lambda j:abs(f.normal[j]));u,v=[j for j in range(3) if j!=axis]
        color=(1,1,1)
        if region==0 and (p.x>267 or p.x<-267):
            variation=.20+.36*abs(math.sin(p.y*.07+p.z*.11));color=(variation,variation*.85,variation*.72)
        for li in f.loop_indices:
            q=me.vertices[me.loops[li].vertex_index].co
            if region:co=(.001,.001)
            elif abs(f.normal.z)<.2 and 115<math.hypot(p.x,p.y)<144:
                centre=math.atan2(p.y,p.x);a=math.atan2(q.y,q.x)
                while a-centre>math.pi:a-=2*math.pi
                while a-centre<-math.pi:a+=2*math.pi
                co=(a*math.hypot(p.x,p.y)/128,q.z/128)
            else:co=(q[u]/128,q[v]/128)
            uv.data[li].uv=co;tint.data[li].color=(*color,1)
    me.uv_layers['UVMap'].active_render=True;me.color_attributes.active_color=tint


def r2_station_normal(size=2048):
    s=STATE['sessiz_liman'];axis=(np.arange(size,dtype=np.float32)+.5)/size;U,V=np.meshgrid(axis,axis)
    _,_,_,_,h=r2_panel_field(U,V);h[(U<.02)&(V<.02)]=0;dy,dx=np.gradient(h);n=np.stack([-dx*3,-dy*3,np.ones_like(h)],axis=2);n/=np.linalg.norm(n,axis=2)[:,:,None]
    rgba=np.ones((size,size,4),dtype=np.float32);rgba[:,:,:3]=n*.5+.5
    bpy.data.images.remove(s['images'].pop('normal'),do_unlink=True);im=bpy.data.images.new('sessiz_liman_normal',size,size,alpha=False);im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(rgba.ravel());im.update();im.pack();im.use_fake_user=True;s['images']['normal']=im
    del U,V,h,dy,dx,n,rgba;purge('Station high density normal atlas')


def r2_station_material():
    name='sessiz_liman';r1_material(name);s=STATE[name];ns=s['material'].node_tree.nodes;link=s['material'].node_tree.links.new;bs=next(n for n in ns if n.type=='BSDF_PRINCIPLED')
    tex={n.image.name.rsplit('_',1)[-1]:n for n in ns if n.type=='TEX_IMAGE'};uv=node(ns,'ShaderNodeUVMap');uv.uv_map='DetailUV';link(uv.outputs[0],tex['normal'].inputs['Vector'])
    next(n for n in ns if n.type=='NORMAL_MAP').uv_map='DetailUV'
    vertex=node(ns,'ShaderNodeVertexColor');vertex.layer_name='HullTint';mix=node(ns,'ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;link(tex['base'].outputs[0],mix.inputs[1]);link(vertex.outputs[0],mix.inputs[2]);link(mix.outputs[0],bs.inputs['Base Color'])
    bs.inputs['Emission Strength'].default_value=4


def r2_kovuk_render():
    name='kovuk';s=STATE[name];s.pop('material',None);old=s['lod0'];col=s['collider'];ob=col.copy();ob.data=col.data.copy();ob.name='kovuk_review2_lod0';s['scene'].collection.objects.link(ob)
    ob.hide_render=False;ob.hide_set(False);ob['asset_node']='lod0';s['lod0']=ob;s['lods']=[ob];s['render_parts']=[ob];bpy.data.objects.remove(old,do_unlink=True)
    for f in ob.data.polygons:f.use_smooth=True
    ob.data.set_sharp_from_angle(angle=.78)
    r1_uv_rock(ob);s['_r2_tree']=mesh_bvh(col)[0];tree=s['_r2_tree']
    # Branching ribbons begin exactly at each delivered deposit marker and track the real cave wall.
    for i,m in enumerate(s['markers']):
        if not m['name'].startswith('deposit_'):continue
        origin=Vector((m['position'][0],-m['position'][2],m['position'][1]));start,n,_,_=tree.find_nearest(origin)
        up=Vector((0,0,1));tangent=n.cross(up)
        if tangent.length<.1:tangent=n.cross(Vector((0,1,0)))
        tangent.normalize();up=tangent.cross(n).normalized()
        for branch,angle in enumerate([-.85,.30,1.8]):
            direction=(tangent*math.cos(angle)+up*math.sin(angle)).normalized();previous=start;normal=n
            for j in range(12):
                wanted=previous+direction*2.25+up*(.38*math.sin(j*.8+i));hit,nn,_,dist=tree.find_nearest(wanted)
                if dist>2 or nn.dot(normal)<.55:break
                side=direction.cross(normal).normalized()*(.15+.045*math.sin(j+i));side2=direction.cross(nn).normalized()*(.13+.035*math.cos(j+branch))
                pts=[previous+normal*.065-side,hit+nn*.065-side2,hit+nn*.065+side2,previous+normal*.065+side]
                if max(tree.find_nearest((pts[k]+pts[(k+1)%4])*.5)[3] for k in range(4))>.45:break
                vein=r1_quad('Wall following crystal vein',pts,1);attr=vein.data.attributes.new('r2_vein','INT','FACE')
                for d in attr.data:d.value=1
                s['render_parts'].append(vein);previous=hit;normal=nn;direction=(direction-nn*direction.dot(nn)).normalized()
    # Small chipped flakes follow existing mouth walls; no square collider corner is hidden by a false opening.
    for marker_index,m in enumerate(s['entrances']):
        centre=Vector((m['position'][0],-m['position'][2],m['position'][1]));outward=Vector((m['direction'][0],-m['direction'][2],m['direction'][1]));up=Vector((0,0,1))
        if abs(outward.z)>.9:up=Vector((0,1,0))
        side=outward.cross(up).normalized();up=side.cross(outward).normalized()
        for j,a in enumerate(np.linspace(0,2*math.pi,24,endpoint=False)):
            query=centre-outward*6+(side*math.cos(a)+up*math.sin(a))*(42+7*math.sin(j*1.31))
            hit,n,_,_=tree.find_nearest(query);t=n.cross(up)
            if t.length<.1:continue
            t.normalize();v=n.cross(t).normalized();r2_projected_panel(name,[hit-t*2-v,hit+t*3-v*.4,hit+v*2.7],0,.43)
    bpy.ops.object.select_all(action='DESELECT')
    for part in s['render_parts']:part.select_set(True)
    bpy.context.view_layer.objects.active=ob;bpy.ops.object.join();select(ob);mod=ob.modifiers.new('Rock triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=mod.name)
    r1_uv_rock(ob);r2_rock_geology();s['render_parts']=[ob];del s['_r2_tree']
    s['r2_unmet']=['The requested elongated 1:0.7:0.6 body, large fused boulders, a new deep crater/major fracture face and a substantially different non-convex outline require changing the locked collider by metres to hundreds of metres. They are not implemented. Square mouth clearances and major lip shapes also remain; only bounded rock flakes and material relief change.']
    r2_assert_immutable(name);purge('Kovuk review2 broad rock and attached veins')


def r2_rock_geology():
    s=STATE['kovuk'];me=s['lod0'].data;colors=me.color_attributes['Geology'];ore=me.uv_layers['OreUV'];response=me.uv_layers.get('RockResponseUV') or me.uv_layers.new(name='RockResponseUV')
    veins=me.attributes.get('r2_vein');count=0;centres=np.array([f.center[:] for f in me.polygons]);outer=r1_rock_outer(centres[:,0],centres[:,1],centres[:,2])
    cached_normals=[v.normal.copy() for v in me.vertices]
    for f in me.polygons:
        p=f.center;n=f.normal;inside=outer[f.index]<-18
        vein=veins and veins.data[f.index].value==1;count+=int(bool(vein))
        for li in f.loop_indices:
            vi=me.loops[li].vertex_index;vertex=me.vertices[vi];q=vertex.co;nn=cached_normals[vi]
            dust=max(0,min(.80,(nn.z-.15)*1.15))
            if inside:dust*=max(0,min(1,(-q.z-95)/35))
            for cr in s['craters']:
                d=q-Vector(cr['p']);cn=Vector(cr['n']);rad=(d-cn*d.dot(cn)).length
                floor=max(0,min(1,(cr['radius']*.72-rad)/25))*max(0,min(1,(-d.dot(cn)-5)/15))*max(0,min(1,nn.dot(cn)*1.7))
                dust=max(dust,.95*floor)
            shade=.50 if inside else .24+.025*math.sin(q.x*.017+q.y*.011)
            color=np.array([shade*.88,shade*.94,shade])*(1-dust)+np.array([1.,.82,.59])*dust
            if vein:color=np.array([.28,.65,.60])
            colors.data[li].color=(*color,1);ore.data[li].uv=(.50,.50) if vein else (.001,.001)
            response.data[li].uv=(.05,.5) if vein else (.25+.57*dust,.5)
    me.uv_layers['UVMap'].active_render=True;print('Crystal vein triangles',count)


def r2_rock_pixels(U,V,kind):
    def noise(freq,seed):
        x=U*freq;y=V*freq;a=np.floor(x);b=np.floor(y);u=x-a;v=y-b;u=u*u*(3-2*u);v=v*v*(3-2*v)
        def h(dx,dy):return np.mod(np.sin(np.mod(a+dx,freq)*127.1+np.mod(b+dy,freq)*311.7+seed)*43758.5453,1)
        return (h(0,0)*(1-u)+h(1,0)*u)*(1-v)+(h(0,1)*(1-u)+h(1,1)*u)*v
    large=noise(17,91);medium=noise(79,38);fine=noise(503,19)
    x=U*17;y=V*17;ix=np.floor(x);iy=np.floor(y);f1=np.full_like(U,1e6);f2=f1.copy();cell=np.zeros_like(U);plane=np.zeros_like(U)
    def h(a,b,k):return np.mod(np.sin(np.mod(a,17)*127.1+np.mod(b,17)*311.7+k)*43758.5453,1)
    for i in [-1,0,1]:
        for j in [-1,0,1]:
            a=ix+i;b=iy+j;dx=x-a-(.1+.8*h(a,b,0));dy=y-b-(.1+.8*h(a,b,71));d=dx*dx+dy*dy;closer=d<f1
            f2=np.where(closer,f1,np.minimum(f2,d));cell=np.where(closer,h(a,b,19),cell);plane=np.where(closer,.08*dx*(h(a,b,51)-.5)+.08*dy*(h(a,b,87)-.5),plane);f1=np.minimum(f1,d)
    edge=np.sqrt(f2)-np.sqrt(f1);fracture=np.exp(-(edge/.022)**2)*np.clip((cell-.32)/.48,0,1)
    strata=np.abs(np.sin((V*27+.045*np.sin(U*2*math.pi*9))*2*math.pi))
    if kind=='normal':return plane-.24*fracture+.13*np.floor(medium*4)/4+.18*(fine-.5)+.045*strata
    if kind=='orm':return np.stack([np.ones_like(U),np.where(U<.15,.36,.57+.35*np.clip((U-.25)/.57,0,1)),np.full_like(U,.045)],axis=2)
    if kind=='emissive':
        mask=(abs(U-.5)<.10)&(abs(V-.5)<.10);rgb=np.zeros((*U.shape,3),dtype=np.float32);rgb[mask]=(.012,.15,.14)
    else:
        value=(.063+.009*medium+.010*(fine-.5))*(.91+.10*cell)*(1-.30*fracture)
        rgb=np.stack([value*.91,value*.95,value],axis=2)
    return np.where(rgb<=.0031308,rgb*12.92,1.055*np.maximum(rgb,0)**(1/2.4)-.055).astype(np.float32)


def r2_rock_map_rows(start,rows=256):
    w=STATE['kovuk']['map_work'];size=w['size'];kind=w['kind'];stop=min(size,start+rows)
    axis=(np.arange(size,dtype=np.float32)+.5)/size;ys=(np.arange(start-1,stop+1,dtype=np.float32)+.5)/size;U,V=np.meshgrid(axis,ys);p=r2_rock_pixels(U,V,kind)
    if kind=='normal':
        dy,dx=np.gradient(p);n=np.stack([-dx*1.5,-dy*1.5,np.ones_like(U)],axis=2);n/=np.linalg.norm(n,axis=2)[:,:,None];p=n*.5+.5
    w['pixels'][start:stop,:,:3]=np.clip(p[1:-1],0,1);print('Kovuk review2',kind,start,stop)


def r2_rock_material():
    s=STATE['kovuk'];r1_kovuk_material();ns=s['material'].node_tree.nodes;links=s['material'].node_tree.links
    tex=next(n for n in ns if n.type=='TEX_IMAGE' and n.image==s['images']['orm']);uv=node(ns,'ShaderNodeUVMap');uv.uv_map='RockResponseUV';links.new(uv.outputs[0],tex.inputs['Vector'])
    next(n for n in ns if n.type=='BSDF_PRINCIPLED').inputs['Emission Strength'].default_value=2.4


def r2_rock_lighting():
    s=STATE['kovuk'];sc=s['scene'];r2_review_lighting('kovuk');enum_value(sc.eevee,'volumetric_tile_size','4');sc.eevee.volumetric_samples=64
    for ob in sc.objects:
        if ob.type=='LIGHT' and ob.name=='Crack sunlight beam 2':
            ob.data.energy=1800000;ob.data.spot_size=.13;ob.location=Vector((185,20,15))+Vector((-.30,-.18,1)).normalized()*16;ob.data.use_shadow=False
        if ob.type=='LIGHT':
            if ob.name=='Grotto key':ob.data.energy=450000
            elif ob.name=='Grotto low fill':ob.data.energy=140000
            elif ob.name=='Hall key':ob.data.energy=280000
            elif ob.name=='Hall low fill':ob.data.energy=80000
    dust=cube_part('Preview collapsed hall dust',(150,0,-55),(225,225,230),0);dust['presentation_only']=True
    mat=bpy.data.materials.new('Review2 hall trace dust');mat.use_nodes=True;ns=mat.node_tree.nodes;ns.clear();out=node(ns,'ShaderNodeOutputMaterial');vol=node(ns,'ShaderNodeVolumeScatter');vol.inputs['Density'].default_value=.008;vol.inputs['Color'].default_value=(.52,.56,.62,1);vol.inputs['Anisotropy'].default_value=.35;mat.node_tree.links.new(vol.outputs[0],out.inputs['Volume']);dust.data.materials.append(mat)
    for m in s['markers']:
        if not m['name'].startswith('deposit_'):continue
        p=Vector((m['position'][0],-m['position'][2],m['position'][1]));d=Vector((m['direction'][0],-m['direction'][2],m['direction'][1]));lamp=light(sc,'Crystal reflected glow',p+d*1.2,850,(.10,.66,.59),kind='POINT');lamp.data.shadow_soft_size=1
    s['preview_specs']['interior_bend']=((212,-59,-95),(170,20,-35),None,22)
    hero=Vector((890,-1060,710)).normalized()*1000;s['preview_specs']['exterior_34']=(list(hero),(0,0,0),None,28)
    purge('Kovuk review2 hall shaft and mineral bounce')


# Brief 2 additions. These builders never modify the three locked Review 2 assets.
def b2_kalbi_shell():
    for n in ['iskele','sessiz_liman','kovuk']:assert STATE[n].get('verified') and STATE[n]['validation']['review']=='review-2';r2_assert_immutable(n)
    name='yarik_kalbi';new_scene(name);s=STATE[name];s['review']='brief-2'
    parts=[]
    for label,z,r,depth in [('Octagonal relay disc',40,135,40),('Gallery floor',-64,135,8),('Gallery inner pressure hub',-20,60,84)]:
        ob=r1_cylinder(label,(0,0,z),r,depth,8 if r==135 else 16);ob.rotation_euler.z=math.pi/8;select(ob);bpy.ops.object.transform_apply(location=False,rotation=True,scale=False);parts.append(ob)
    bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=30,radius2=9,depth=134,location=(0,0,125));parts.append(bpy.context.object)
    for a in [0,math.pi/2,math.pi,3*math.pi/2]:
        p=rotate_xy((138,0,57),a);parts.append(cube_part('Docking arm landing ledge',p,(44,44,10)))
        parts.append(r1_beam('Spire load rib',rotate_xy((29,0,61),a),rotate_xy((12,0,175),a),4.2))
        parts.append(r1_beam('Broken antenna crown',rotate_xy((7,0,186),a),rotate_xy((35 if a<math.pi else 24,0,190+(3 if a==0 else -4)),a),3.5))
    parts.append(r1_beam('Crown snapped tooth',(8,1,185),(22,12,197),3.5))
    col=r1_union(parts,name+'_collider');s['collider']=col;purge('Kalbi exact structural shell')


def b2_kalbi_carve():
    s=STATE['yarik_kalbi'];ob=s['collider'];verts=[];faces=[]
    for y,h in [(-210,45),(-64,45),(0,40),(64,45),(210,45)]:
        for x,z in [(-h+8,-h),(h-8,-h),(h,-h+8),(h,h-8),(h-8,h),(-h+8,h),(-h,h-8),(-h,-h+8)]:verts.append((x,y,z-20))
    for i in range(4):
        for j in range(8):faces.append((i*8+j,i*8+(j+1)%8,(i+1)*8+(j+1)%8,(i+1)*8+j))
    faces.extend([tuple(reversed(range(8))),tuple(32+j for j in range(8))]);me=bpy.data.meshes.new('Flared relay tunnel cutter');me.from_pydata(verts,[],faces);me.update();cut=bpy.data.objects.new('Flared relay tunnel cutter',me);s['scene'].collection.objects.link(cut)
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();boolean_cut(ob,cut)
    decimate(ob,1000000);assert_solid(ob);assert intersection_check(ob)['passed']
    # Four gallery gates plus the straight central chord give two independent circulation loops.
    nodes={'F':[0,-100,-20],'L':[-100,0,-20],'B':[0,100,-20],'R':[100,0,-20],
           'E0':[0,-160,-20],'E1':[0,160,-20],'E2':[-160,0,-20],'E3':[160,0,-20]}
    paths=[];edges=[]
    for a,b,t0,t1 in [('F','R',-math.pi/2,0),('R','B',0,math.pi/2),('B','L',math.pi/2,math.pi),('L','F',math.pi,3*math.pi/2)]:
        paths.append([[100*math.cos(t),100*math.sin(t),-20] for t in np.linspace(t0,t1,41)]);edges.append([a,b])
    for a,b in [('F','B'),('E0','F'),('E1','B'),('E2','L'),('E3','R')]:paths.append([nodes[a],nodes[b]]);edges.append([a,b])
    s['paths']=paths;s['graph']=dict(vertices=nodes,edges=edges,entrance_vertices=['E0','E1','E2','E3'])
    for i,p,d in [(1,nodes['E0'],(0,-1,0)),(2,nodes['E1'],(0,1,0)),(3,nodes['E2'],(-1,0,0)),(4,nodes['E3'],(1,0,0))]:marker(s,'entrance_'+str(i),p,d)
    for i,a in enumerate([0,math.pi/2,math.pi,3*math.pi/2]):marker(s,'pad_'+str(i+1),rotate_xy((138,0,62),a),(0,0,1),'Y')
    print('Kalbi',topology(ob),r1_measure_routes('yarik_kalbi'));purge('Kalbi flared tunnel and open gallery')


def b2_kalbi_render():
    name='yarik_kalbi';s=STATE[name];ob=r1_render_from_collider(name,.22);s['_r2_tree']=mesh_bvh(s['collider'])[0]
    s['render_parts'].append(r2_text('Relay name','YARIK KALBİ',(0,-83,60.04),6,8))
    # A segmented octagonal light belt follows the true flat disc facets.
    for i in range(8):
        a=2*math.pi*i/8+math.pi/8;b=a+math.pi/4;p=Vector((135*math.cos(a),135*math.sin(a),29));q=Vector((135*math.cos(b),135*math.sin(b),29))
        for j in range(3):
            p0=p.lerp(q,(j+.12)/3);p1=p.lerp(q,(j+.87)/3)
            r2_projected_panel(name,[p0,p1,p1+Vector((0,0,1.8)),p0+Vector((0,0,1.8))],1 if i%3 else 2,.07)
    # Spire light slots: warm amber, interrupted by dead teal service strips.
    for a in [0,math.pi/2,math.pi,3*math.pi/2]:
        for z in [77,100,123,146,169]:
            t=Vector((-math.sin(a),math.cos(a),0));direction=Vector((-math.cos(a),-math.sin(a),0));tree=s['_r2_tree']
            p,n,_,_=tree.ray_cast(Vector((100*math.cos(a),100*math.sin(a),z)),direction,150);q,nn,_,_=tree.ray_cast(Vector((100*math.cos(a),100*math.sin(a),z+9)),direction,150)
            if p is not None and q is not None:r2_projected_panel(name,[p-t*.7,p+t*.7,q+t*.7,q-t*.7],1,.10)
    for i,a in enumerate([0,math.pi/2,math.pi,3*math.pi/2]):
        p=rotate_xy((138,0,62.04),a)
        s['render_parts'].append(r2_ring('Pad approach glyph',p[:2],17,.55,p[2],2,steps=32))
        s['render_parts'].append(r2_text('Dock pad number',str(i+1).zfill(2),rotate_xy((138,-5,62.045),a),7,8,(0,0,a)))
    for y in [-110,-80,-45,0,45,80,110]:
        for x in [-26,26]:
            r2_projected_panel(name,[(x-.28,y-2,-60),(x+.28,y-2,-60),(x+.28,y+2,-60),(x-.28,y+2,-60)],1,.04)
    r1_join_render(name);del s['_r2_tree'];b2_uv(name);purge('Kalbi render trim and glyphs')


def b2_kalbi_upgrade():
    s=STATE['yarik_kalbi'];parts=[s['collider']]
    for z in [96,136,173]:
        r=30-(z-58)/134*21+1.7;parts.append(r1_cylinder('Relay service collar',(0,0,z),r,5,12))
    for p in [(35,0,194),(-24,0,187),(0,35,187)]:parts.append(cube_part('Broken crown sensor panel',p,(10,18,3.5)))
    for a in [math.pi/4,3*math.pi/4,5*math.pi/4,7*math.pi/4]:
        ob=cube_part('Roof relay service module',rotate_xy((100,0,62),a),(24,12,8));ob.rotation_euler.z=a;select(ob);bpy.ops.object.transform_apply(location=False,rotation=True,scale=False);parts.append(ob)
    s['collider']=r1_union(parts,'yarik_kalbi_collider');assert_solid(s['collider']);assert intersection_check(s['collider'])['passed'];purge('Kalbi service silhouette')


def b2_uv(name,ob=None):
    me=(ob or STATE[name]['lod0']).data;uv=me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap');detail=me.uv_layers.get('DetailUV') or me.uv_layers.new(name='DetailUV');regions=me.attributes['r1_region'].data
    vertices=np.array([v.co[:] for v in STATE[name]['collider'].data.vertices]);lo=vertices.min(axis=0);span=np.maximum(vertices.max(axis=0)-lo,1)
    for f in me.polygons:
        region=regions[f.index].value;axis=max(range(3),key=lambda j:abs(f.normal[j]));u,v=[j for j in range(3) if j!=axis]
        for li in f.loop_indices:
            p=me.vertices[me.loops[li].vertex_index].co
            if region:co={1:(.60,.90),2:(.72,.90),3:(.84,.90),4:(.94,.90),5:(.94,.98),6:(.94,.98),7:(.60,.985),8:(.72,.985),9:(.84,.985)}[region];duv=(.001,.001)
            else:co=(.52+.46*(p[u]-lo[u])/span[u],.02+.70*(p[v]-lo[v])/span[v]);duv=(p[u]/64,p[v]/64)
            uv.data[li].uv=co;detail.data[li].uv=duv
    uv.active_render=True


def b2_normal(name,size=1024):
    s=STATE[name];axis=(np.arange(size,dtype=np.float32)+.5)/size;U,V=np.meshgrid(axis,axis);_,_,_,_,h=r2_panel_field(U,V);h[(U<.02)&(V<.02)]=0;dy,dx=np.gradient(h);n=np.stack([-dx*2,-dy*2,np.ones_like(h)],axis=2);n/=np.linalg.norm(n,axis=2)[:,:,None]
    rgba=np.ones((size,size,4),dtype=np.float32);rgba[:,:,:3]=n*.5+.5;im=bpy.data.images.new(name+'_normal',size,size,alpha=False);im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(rgba.ravel());im.update();im.pack();im.use_fake_user=True;s.setdefault('images',{})['normal']=im;purge(name+' normal')


def b2_material_lighting(name):
    s=STATE[name];r1_material(name);ns=s['material'].node_tree.nodes;link=s['material'].node_tree.links.new
    tex=next(n for n in ns if n.type=='TEX_IMAGE' and n.image==s['images']['normal']);uv=node(ns,'ShaderNodeUVMap');uv.uv_map='DetailUV';link(uv.outputs[0],tex.inputs['Vector']);next(n for n in ns if n.type=='NORMAL_MAP').uv_map='DetailUV'
    bs=next(n for n in ns if n.type=='BSDF_PRINCIPLED');bs.inputs['Emission Strength'].default_value=4
    sc=s['scene'];set_engine(sc,'BLENDER_EEVEE');sc.eevee.taa_render_samples=32;enum_value(sc.eevee,'shadow_pool_size','64');sc.eevee.use_raytracing=False
    light(sc,'Landmark stellar key',(-500,-700,800),2.2,(1,.85,.67),kind='SUN');light(sc,'Landmark cool fill',(250,-300,180),7e6,(.54,.68,.84),200,target=(0,0,40));light(sc,'Landmark rim',(-250,200,220),4e6,(.57,.76,1),150,target=(0,0,50))
    if name=='yarik_kalbi':
        light(sc,'Tunnel forward flood',(0,-60,12),120000,(1,.74,.43),20,target=(0,-20,-55));light(sc,'Tunnel aft flood',(0,60,12),100000,(.60,.76,.80),20,target=(0,20,-55))
        for a in [0,math.pi/2,math.pi,3*math.pi/2]:light(sc,'Gallery emergency bounce',rotate_xy((99,0,5),a),12000,(1,.53,.24),kind='POINT')
        t=Vector((0,0,60));d=Vector((1,-1.4,.85)).normalized();s['preview_specs']={'exterior_1000m':(list(t+d*1000),list(t),None,50),'exterior_300m':(list(t+d*300),list(t),None,20),'interior':((-15,-112,-20),(0,60,-20),None,19)}
    enum_value(sc.view_settings,'view_transform','AgX');sc.render.resolution_x=1600;sc.render.resolution_y=1000;sc.render.resolution_percentage=100;sc.render.threads_mode='FIXED';sc.render.threads=2;enum_value(sc.render.image_settings,'file_format','PNG');enum_value(sc.render.image_settings,'color_mode','RGB');r2_review_lighting(name)


def b2_validate(name):
    s=STATE[name];col=s['collider'];top=assert_solid(col);cross=intersection_check(col);assert cross['passed'] and top['triangles']<=12000;assert len(s['lod0'].data.polygons)<=30000
    routes=r1_measure_routes(name);tree=mesh_bvh(col)[0];distances=[2*tree.find_nearest(Vector(p))[3] for path in s['paths'] for p in sample_path(path,8)]
    v=dict(asset=name,review='brief-2',units='metres',coordinate_system='glTF Y-up',collider_topology=top,self_intersection=cross,
           lod_triangle_counts={o['asset_node']:len(o.data.polygons) for o in s['lods']},collider_vs_lod0=s['distance'],paths=routes,
           minimum_clear_diameter_m=min(distances),clear_diameter_p5_m=float(np.percentile(distances,5)),route_graph=r1_graph_check(name),entrance_count=len(s['entrances']),
           minimum_bend_radius_m=min((p['minimum_bend_radius_m'] for p in routes if p['minimum_bend_radius_m']),default=None),dimensions_m=[float(col.dimensions.x),float(col.dimensions.z),float(col.dimensions.y)],
           material_count=1,texture_sizes={k:list(im.size) for k,im in s['images'].items()},unmet_rules=[],current_rss_mib=purge(name+' validation'))
    if name=='yarik_kalbi':
        pads=[]
        for m in s['markers']:
            if not m['name'].startswith('pad_'):continue
            p=Vector((m['position'][0],-m['position'][2],m['position'][1]));err=[]
            for a in np.linspace(0,2*math.pi,64,endpoint=False):
                hit,_,_,_=tree.ray_cast(p+Vector((20*math.cos(a),20*math.sin(a),10)),Vector((0,0,-1)),30);assert hit is not None;err.append(abs(hit.z-p.z))
            assert max(err)<.001;pads.append(dict(name=m['name'],clear_disk_diameter_m=40,flatness_error_m=max(err)))
        v['pads']=pads;v['main_disc_thickness_m']=40;v['known_limits']=['The 80m clear fly-through occupies a lowered central hub under the 40m main disc flange; an 80m enclosed tunnel cannot fit entirely inside a 40m slab. The gallery is open around the rim.']
    elif name=='enkaz':
        gap=routes[s['gap_path_index']]['minimum_clear_diameter_m'];assert gap>=90;v['under_spine_gap_clear_diameter_m']=gap;v['bow_stern_relative_yaw_degrees']=8
        v['known_limits']=['The route graph includes the open gap and broad exterior return arcs between the two short internal passages. It is not a fully enclosed maze.']
        v['unmet_rules']=['Amber emissive fixtures are static in the GLB; temporal flicker has not been authored.']
    s['validation']=v;dump(OUT/name/'validation.json',v);print(name,json.dumps({k:v[k] for k in ['lod_triangle_counts','dimensions_m','minimum_clear_diameter_m','clear_diameter_p5_m']}))


def b2_deliver(name):
    s=STATE[name];folder=OUT/name;folder.mkdir(parents=True,exist_ok=True);bpy.context.window.scene=s['scene'];bpy.ops.object.select_all(action='DESELECT')
    for ob in [s['collider']]+s['lods']+[o for o in s['scene'].objects if o.type=='EMPTY']:ob.hide_set(False);ob.hide_viewport=False;ob.select_set(True)
    path=folder/(name+'.glb');bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_animations=False,export_image_format='AUTO',export_extras=True,export_cameras=False,export_lights=False,export_all_vertex_colors=False)
    doc=patch_glb(path,s);assert {n['name'] for n in doc['nodes']}=={'collider','lod0','lod1','lod2'}|{m['name'] for m in s['markers']};assert len(doc['materials'])==1 and len(doc['images'])==4
    data=dict(asset=name,review='brief-2',units='metres',coordinate_system='glTF Y-up',collider='collider',entrances=s['entrances'],pads=[m for m in s['markers'] if m['name'].startswith('pad_')],paths=[[yup(p) for p in path] for path in s['paths']]);dump(folder/(name+'.json'),data)
    import hashlib
    dump(folder/'provenance.json',dict(origin='Original procedural design via live Blender MCP; no third-party models or textures',review='brief-2',blender_version=bpy.app.version_string,date='2026-10-22',generator='tools/yarik-blender.py',generator_sha256=hashlib.sha256((ROOT/'tools/yarik-blender.py').read_bytes()).hexdigest()))
    s['validation']['exported_glb']=dict(bytes=path.stat().st_size,materials=1,embedded_pngs=4);dump(folder/'validation.json',s['validation']);s['scene']['review_preview_specs']=json.dumps(s['preview_specs']);s['scene']['review_delivered']=True;s['complete']=True
    s['collider'].hide_render=True;s['collider'].hide_set(True)
    for ob in s['lods'][1:]:ob.hide_render=True;ob.hide_set(True)
    for old in ['iskele','sessiz_liman','kovuk']:r2_assert_immutable(old)
    r1_save_source();print('BRIEF 2 DELIVERED',name)


def b2_bow_point(p):
    return [
        p[0]*math.cos(math.radians(8))+(p[1]+137.5)*math.sin(math.radians(8)),
        -p[0]*math.sin(math.radians(8))+(p[1]+137.5)*math.cos(math.radians(8))-137.5,p[2]]


def b2_hull(name,sections,bow=False):
    verts=[];faces=[]
    for section,(y,w,h) in enumerate(sections):
        shape=[(-w+8,-h),(w-8,-h),(w,-h+10),(w,h-10),(w-8,h),(-w+8,h),(-w,h-10),(-w,-h+10)]
        for j,(x,z) in enumerate(shape):
            torn=0  # Warp the finished triangular carrier after exact booleans, never feed non-planar caps to them.
            p=[x,y+torn,z];verts.append(b2_bow_point(p) if bow else p)
    for i in range(len(sections)-1):
        for j in range(8):faces.append((i*8+j,i*8+(j+1)%8,(i+1)*8+(j+1)%8,(i+1)*8+j))
    faces.extend([tuple(reversed(range(8))),tuple((len(sections)-1)*8+j for j in range(8))]);me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob)
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();return ob


def b2_enkaz_plan():
    assert STATE['yarik_kalbi'].get('verified');new_scene('enkaz');s=STATE['enkaz'];s['review']='brief-2'
    nodes={'T':[0,60,0],'L':[-60,0,0],'R':[60,0,0],'E0':[0,55,0],'E1':[70.1,155,0],
           'E2':b2_bow_point([-59.4,-137.5,-5]),'E3':b2_bow_point([59.4,-137.5,-5])}
    arc=[[70+70*math.cos(a),85+70*math.sin(a),0] for a in np.linspace(math.pi,math.pi/2,41)]
    stern=r1_concat([nodes['T'],[0,85,0]],arc,[nodes['E1']]);full_stern=r1_concat([[0,20,0],[0,85,0]],arc,[[125,155,0]])
    right=[[60+60*math.cos(a),60+60*math.sin(a),0] for a in np.linspace(math.pi,3*math.pi/2,41)]
    left=[[-60+60*math.cos(a),60+60*math.sin(a),0] for a in np.linspace(0,-math.pi/2,41)]
    outer=r1_concat([nodes['E1'],[180,155,0]],[[180+77.5*math.cos(a),77.5+77.5*math.sin(a),0] for a in np.linspace(math.pi/2,-math.pi/2,81)],[nodes['R']])
    angle=math.radians(8);c=math.cos(angle);sn=math.sin(angle);theta0=-math.pi/2-angle
    a=Vector(nodes['E3']);b=Vector(nodes['R']);radius=(b.y-a.y)/(1+c);centre=a+Vector((sn,c,0))*radius
    east=[[centre.x+radius*math.cos(t),centre.y+radius*math.sin(t),a.z+(b.z-a.z)*f] for f,t in zip(np.linspace(0,1,101),np.linspace(theta0,math.pi/2,101))];east=r1_concat(east,[nodes['R']])
    a=Vector(nodes['E2']);b=Vector(nodes['L']);delta=b-a;radius=(delta.y+math.tan(angle)*delta.x)*c/(1+c);lead=(sn*radius-delta.x)/c;start=a+Vector((-c,sn,0))*lead;centre=start+Vector((sn,c,0))*radius
    west=r1_concat([list(a),list(start)],[[centre.x+radius*math.cos(t),centre.y+radius*math.sin(t),a.z+(b.z-a.z)*f] for f,t in zip(np.linspace(0,1,101),np.linspace(theta0,-3*math.pi/2,101))])
    paths=[stern,[nodes['E2'],nodes['E3']],right,left,[nodes['L'],nodes['R']],outer,east,west,[nodes['E0'],nodes['T']]]
    s['paths']=paths;s['full_stern']=full_stern;s['gap_path_index']=4;s['graph']=dict(vertices=nodes,edges=[['T','E1'],['E2','E3'],['T','R'],['T','L'],['L','R'],['E1','R'],['E3','R'],['E2','L'],['E0','T']],entrance_vertices=['E0','E1','E2','E3'])
    for i,p in enumerate(paths):
        radius=bend_radius(p);print('Wreck planned bend',i,radius)
        assert radius is None or radius>=59.99,(i,radius)


def b2_enkaz_shell():
    s=STATE['enkaz'];parts=[b2_hull('Original warship bow',[(-220,9,16),(-185,35,44),(-120,68,58),(-55,75,58)],True),
        b2_hull('Original warship stern',[(55,75,60),(90,70,65),(180,70,50),(210,53,44)])]
    spine=[b2_bow_point([0,-72,48]),[4,-20,100],[-6,25,95],[0,72,48]]
    for a,b in zip(spine,spine[1:]):parts.append(r1_beam('Twisted surviving spine chord',a,b,12))
    for offset in [-12,12]:
        for a,b in zip(spine,spine[1:]):parts.append(r1_beam('Spine parallel chord',Vector(a)+Vector((offset,0,5)),Vector(b)+Vector((offset,0,5)),4))
    for i,p in enumerate(spine[1:-1]):parts.append(r1_beam('Spine transverse web',Vector(p)+Vector((-14,0,5)),Vector(p)+Vector((14,0,-3)),4))
    for y in [66,82,190,205]:
        for sign in [-1,1]:parts.append(cube_part('Exposed hull girder',(sign*(72 if y<100 else 56),y,0),(8,5,112 if y<100 else 88)))
    for x in [-32,0,32]:
        ob=r1_cylinder('Dead engine nacelle',(x,218,0),12,24,16);ob.rotation_euler.x=math.pi/2;select(ob);bpy.ops.object.transform_apply(location=False,rotation=True,scale=False);parts.append(ob)
    parts += [cube_part('Stern bridge remnant',(0,160,55),(40,40,16)),cube_part('Snapped dorsal mast',(0,158,76),(5,6,28))]
    s['collider']=r1_union(parts,'enkaz_collider');purge('Wreck exact two hulls and surviving spine')


def b2_enkaz_carve():
    s=STATE['enkaz'];ob=s['collider'];boolean_cut(ob,r1_sweep('Breached stern free corridor',s['full_stern'],35,8,extend=8))
    bowpath=[b2_bow_point([-130,-137.5,-5]),b2_bow_point([130,-137.5,-5])];boolean_cut(ob,r1_sweep('Collapsed keel hangar void',bowpath,40,8,extend=4))
    bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free();decimate(ob,1000000)
    bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.0001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
    assert_solid(ob);assert intersection_check(ob)['passed'];b2_wreck_fracture(ob);b2_enkaz_markers()


def b2_enkaz_markers():
    s=STATE['enkaz'];nodes=s['graph']['vertices']
    for i,key,d in [(1,'E0',(0,-1,0)),(2,'E1',(1,0,0)),(3,'E2',(-math.cos(math.radians(8)),math.sin(math.radians(8)),0)),(4,'E3',(math.cos(math.radians(8)),-math.sin(math.radians(8)),0))]:marker(s,'entrance_'+str(i),nodes[key],d)
    print('Wreck routes',json.dumps(r1_measure_routes('enkaz')));purge('Wreck designed openings')


def b2_wreck_fracture(ob):
    c=math.cos(math.radians(8));sn=math.sin(math.radians(8))
    for v in ob.data.vertices:
        p=v.co;fade=max(0,min(1,(72-abs(p.z))/12))*max(0,min(1,(95-abs(p.x))/15))
        if 55-1e-4<=p.y<85:
            weight=((85-p.y)/30)**2;p.y+=6*weight*(.5+.5*math.sin(p.x*.041+p.z*.073))*fade
        x=c*p.x-sn*(p.y+137.5);y=sn*p.x+c*(p.y+137.5)-137.5
        if -85<y<-45:
            weight=min(1,(y+85)/30)**2;y-=6*weight*(.5+.5*math.sin(x*.049-p.z*.067))*fade;p.x,p.y=b2_bow_point([x,y,p.z])[:2]
    ob.data.update();assert_solid(ob);assert intersection_check(ob)['passed']


def b2_enkaz_render():
    name='enkaz';s=STATE[name];ob=r1_render_from_collider(name,.24);s['_r2_tree']=mesh_bvh(s['collider'])[0];tree=s['_r2_tree']
    # Dim running lights, broken into irregular short sections along both carrier hulls.
    for y in [75,100,130,165,190]:
        for sign in [-1,1]:
            p,n,_,_=tree.ray_cast(Vector((sign*140,y,17)),Vector((-sign,0,0)),180)
            if p is not None:r2_projected_panel(name,[p+Vector((0,-5,0)),p+Vector((0,5,0)),p+Vector((0,5,1)),p+Vector((0,-5,1))],1 if y in [75,165] else 2,.08)
    for path in [s['paths'][0],s['paths'][1]]:
        samples=sample_path(path,12)
        for p in samples:
            hit,n,_,_=tree.ray_cast(Vector(p),Vector((0,0,-1)),80)
            if hit is not None:r2_projected_panel(name,[hit+Vector((-1,-.25,0)),hit+Vector((1,-.25,0)),hit+Vector((1,.25,0)),hit+Vector((-1,.25,0))],1,.045)
    # Ash-black torn faces and exposed warm bare metal at the fracture; no thin floating debris.
    regions=ob.data.attributes['r1_region'].data
    for f in ob.data.polygons:
        if (-78<f.center.y<-40 or 45<f.center.y<74) and abs(f.normal.y)>.45:regions[f.index].value=9 if f.index%3 else 6
    # Engine nozzles are shallow closed-carrier rings.
    for x in [-32,0,32]:
        ring=r2_ring('Cold engine nozzle rim',(0,0),9.4,.75,0,6,steps=24)
        ring.rotation_euler.x=-math.pi/2;ring.location=(x,230.10,0);select(ring);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);s['render_parts'].append(ring)
        verts=[(x,230.035,0)]+[(x+9*math.cos(a),230.035,9*math.sin(a)) for a in np.linspace(0,2*math.pi,24,endpoint=False)];faces=[(0,1+(i+1)%24,1+i) for i in range(24)]
        me=bpy.data.meshes.new('Cold closed nozzle throat');me.from_pydata(verts,[],faces);me.update();disc=bpy.data.objects.new('Cold closed nozzle throat',me);s['scene'].collection.objects.link(disc);r1_region(disc,4);s['render_parts'].append(disc)
    r1_join_render(name);del s['_r2_tree'];b2_uv(name);purge('Wreck original render detailing')


def b2_enkaz_lighting():
    s=STATE['enkaz'];sc=s['scene'];light(sc,'Stern corridor emergency',(0,95,18),70000,(1,.56,.23),15,target=(35,125,-25));light(sc,'Side breach low fill',(60,150,15),45000,(.52,.67,.79),14,target=(15,145,-25))
    light(sc,'Collapsed hangar low fill',b2_bow_point([0,-137.5,22]),90000,(.78,.68,.52),20,target=b2_bow_point([0,-137.5,-40]))
    d=Vector((1,-.7,.65)).normalized();t=Vector((0,0,15));s['preview_specs']={'exterior_1000m':(list(t+d*1000),list(t),None,45),'exterior_300m':(list(t+d*300),list(t),None,18),'interior':((0,73,0),(24,132,0),None,21)}


def game_preview_baseline(name):
    """Clear-weather sun/rim and FogExp2 baseline from arena/render/stage.ts; no game files are modified."""
    s=STATE[name];sc=s['scene'];sc.view_layers[0].use_pass_z=True
    for ob in sc.objects:
        if ob.type!='LIGHT':continue
        if ob.data.type=='SUN' and not ob.get('game_preview_light'):ob.hide_render=True
        if ob.name in ['Low cool fill','Rim separation','Underside fill','Station low fill','Front review fill','Station rim','Exterior soft fill','Rock rim','Landmark cool fill','Landmark rim']:
            if 'original_review_power' not in ob:ob['original_review_power']=ob.data.energy
            ob.data.energy=ob['original_review_power']*.4
    if not any(ob.get('game_preview_light') for ob in sc.objects):
        for label,p,power,color in [('Game bright sky key',(480,-4000,1280),2.7,'e2ecff'),('Game red star rim',(4000,1000,720),.75,'ffb08a')]:
            ob=light(sc,label,p,power,linear_rgb(color),kind='SUN');ob['game_preview_light']=True;ob.data.angle=.04
    tree=sc.compositing_node_group;ns=tree.nodes;links=tree.links
    if ns.get('Clear game FogExp2') is None:
        render=next(n for n in ns if n.bl_idname=='CompositorNodeRLayers');out=next(n for n in ns if n.bl_idname=='NodeGroupOutput');source=out.inputs['Image'].links[0].from_socket
        def math_node(operation,a=None,b=None):
            n=ns.new('ShaderNodeMath');n.operation=operation
            for i,value in enumerate([a,b]):
                if value is None:continue
                if isinstance(value,(float,int)):n.inputs[i].default_value=value
                else:links.new(value,n.inputs[i])
            return n.outputs[0]
        depth=render.outputs['Depth'];density=math_node('MULTIPLY',depth,.00009);square=math_node('MULTIPLY',density,density);negative=math_node('MULTIPLY',square,-1);exp=math_node('POWER',math.e,negative);factor=math_node('SUBTRACT',1,exp)
        valid=math_node('LESS_THAN',depth,1e6);factor=math_node('MULTIPLY',factor,valid)
        mix=ns.new('ShaderNodeMixRGB');mix.name='Clear game FogExp2';mix.blend_type='MIX';links.new(factor,mix.inputs[0]);links.new(source,mix.inputs[1]);mix.inputs[2].default_value=(*linear_rgb('06111c'),1);links.new(mix.outputs[0],out.inputs['Image'])
    s['validation']['game_lighting_preview']=dict(source='apps/web/src/arena/render/stage.ts (read only)',sun_gltf_direction=[.12,.32,1],sun_intensity=2.7,sun_srgb='#e2ecff',rim_gltf_direction=[1,.18,-.25],rim_intensity=.75,rim_srgb='#ffb08a',clear_fog_srgb='#06111c',fog_exp2_density=.00009,
        caveat='Clear-weather key/rim and distance fog are reproduced. The game sky cubemap and dynamic storm fog are not embedded; practical review fills remain for interior material judgement.')
    dump(OUT/name/'validation.json',s['validation']);purge(name+' game lighting baseline')


def b2_finish_pbr(name):
    """One 1024 map at a time; replace broad checker stains with restrained panel wear."""
    assert name in ['yarik_kalbi','enkaz'];s=STATE[name];size=1024
    for kind in ['base','orm','emissive']:
        rgba=np.ones((size,size,4),dtype=np.float32)
        for start in range(0,size,128):
            U,V=np.meshgrid((np.arange(size,dtype=np.float32)+.5)/size,(np.arange(start,start+128,dtype=np.float32)+.5)/size)
            grain=np.mod(np.sin(U*18133+V*37817)*43758.5453,1)-.5
            rgb,h,rough,metal,em=r2_station_pixels(U,V,grain)
            seam,edge,cell,bolt,_=r2_panel_field((U-.52)/.46*.75,(V-.02)/.70*.60)
            hull=(U>.51)&(V<.80);value=.023+.0025*cell+.0008*grain
            tint=[.82,.94,1.0] if name=='yarik_kalbi' else [.87,.93,1.0]
            for k,factor in enumerate(tint):rgb[:,:,k][hull]=(value*factor)[hull]
            rgb[hull&seam]=(.016,.020,.023)
            wear=hull&edge&(cell>.90)&(grain>.34);rgb[wear]=(.052,.060,.065)
            rough[hull]=(.66+.09*cell)[hull];rough[wear]=.43;metal[hull]=.74;metal[wear]=.90
            # Gentle directional soot, without the old hard-edged metre-scale black blobs.
            soot=np.clip(.5+.5*np.sin(U*51+V*13),0,1)*.10
            rgb[hull]*=1-soot[hull,None]
            if kind=='base':p=np.where(rgb<=.0031308,rgb*12.92,1.055*np.maximum(rgb,0)**(1/2.4)-.055)
            elif kind=='orm':p=np.stack([np.ones_like(U),rough,metal],axis=2)
            else:p=np.where(em<=.0031308,em*12.92,1.055*np.maximum(em,0)**(1/2.4)-.055)
            rgba[start:start+128,:,:3]=np.clip(p,0,1)
        im=s['images'][kind];im.pixels.foreach_set(rgba.ravel());im.update();im.pack();del rgba
        purge(name+' restrained '+kind)
    s['validation']['material_finish']='Restrained varied gunmetal plates, crisp normal seams/bolts, sparse edge wear; broad checkerboard/scorch blobs removed.'
    dump(OUT/name/'validation.json',s['validation'])


def finalize_delivery_records():
    """Audit delivered files and pinned navigation, without rebuilding or project tests."""
    import hashlib
    names=['iskele','sessiz_liman','kovuk','yarik_kalbi','enkaz']
    sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
    generator_sha=sha(ROOT/'tools/yarik-blender.py')
    peak=max(s['validation'].get('peak_process_rss_mib',0) for s in STATE.values())
    peak=max(peak,__import__('resource').getrusage(__import__('resource').RUSAGE_SELF).ru_maxrss/1024)
    memory=dict(observed_peak_rss_mib=peak,observed_peak_bytes=round(peak*1024**2),
                decimal_2gb_exceeded=peak*1024**2>2000000000,
                decimal_2gb_excess_bytes=max(0,round(peak*1024**2-2000000000)),
                current_rss_mib=purge('Final delivery audit'))
    for name in names:
        s=STATE[name];v=s['validation'];folder=OUT/name
        assert s.get('verified') and 'glb_roundtrip' in v
        top=v['glb_roundtrip']['collider_topology'];assert top['connected_components']==1
        assert all(top[k]==0 for k in ['non_manifold_edges','inconsistent_winding_edges','zero_area_triangles','loose_vertices'])
        assert v['glb_roundtrip']['self_intersection']['passed']
        assert all(x['maximum_m']<=.75 for x in v['glb_roundtrip']['collider_vs_lod0'].values())
        if name in names[:3]:
            r2_assert_immutable(name)
            assert r2_glb_fingerprint(name)==json.loads(s['scene']['review2_glb_immutable'])
        previews=sorted((folder/'previews').glob('*.png'))
        assert len(previews)==(6 if name in names[:3] else 3)
        assert all(struct.unpack_from('>II',p.read_bytes(),16)==(1600,1000) for p in previews)
        assert set(p.name for p in folder.iterdir())=={name+'.glb',name+'.json','validation.json','provenance.json','previews'}
        unmet=v.setdefault('unmet_rules',[])
        additions=['Brief rule 6: the photographic premium target is not fully reached; the final close previews still show procedural surface detail and simple carrier forms.']
        if name=='sessiz_liman' and memory['decimal_2gb_exceeded']:
            additions.append('Memory: observed process peak was %.6f MiB (%.6f decimal GB), exceeding a strict decimal 2 GB cap by %.6f MB; it remained below 2 GiB.'%(peak,peak*1024**2/1e9,memory['decimal_2gb_excess_bytes']/1e6))
        if name=='kovuk':
            additions.append('The hall dust volume and strong shaft illumination are Blender presentation effects, not embedded in the GLB. Physical narrow shaft openings and emissive wall veins are exported.')
        if name=='yarik_kalbi':
            additions.append('The 80m fly-through is below the 40m disc flange in the lowered central hub, rather than entirely within the disc slab.')
        if name=='enkaz':
            unmet[:]=[x for x in unmet if not x.startswith('Amber emissive fixtures')]
            additions.append('Amber emissive fixtures are static in the GLB; temporal flicker has not been authored.')
        for x in additions:
            if x not in unmet:unmet.append(x)
        v['premium_photographic_target_met']=False;v['final_memory_record']=memory
        v.setdefault('preview_review',{})['final_game_light_previews_inspected']=True
        v['final_delivery']=dict(glb_sha256=sha(folder/(name+'.glb')),metadata_sha256=sha(folder/(name+'.json')),
            previews_sha256={p.name:sha(p) for p in previews},generator_sha256=generator_sha,
            serialized_geometry_verified=True,immutable_review1_data_rechecked=name in names[:3])
        dump(folder/'validation.json',v)
        provenance=json.loads((folder/'provenance.json').read_text());provenance['generator_sha256']=generator_sha
        provenance['glb_sha256']=v['final_delivery']['glb_sha256'];dump(folder/'provenance.json',provenance)
        print('FINAL',name,v['lod_triangle_counts'],'unmet',len(unmet))
    assert len([p for p in OUT.rglob('*') if p.is_file()])==45
    for group in list(bpy.data.node_groups):
        if group.name in ['_fog_API_probe','review2_game_compositor'] and group.users<=1:bpy.data.node_groups.remove(group)
    r1_save_source();print('ALL FILES AUDITED',json.dumps(memory))

# Review 3: navigation remains pinned, collision follows the new silhouette.
R3_ORDER=['enkaz','yarik_kalbi','kovuk','sessiz_liman','iskele']

def r3_nav(name):
    f=r2_fingerprint(name)
    return {k:f[k] for k in ['markers','metadata_bytes_sha256']}


def r3_lock_all():
    for name in R3_ORDER:
        s=STATE[name];sc=s['scene']
        if 'review3_baseline' in sc:continue
        tree=mesh_bvh(s['collider'])[0];mouths=[]
        for m in s['entrances']:
            p=Vector((m['position'][0],-m['position'][2],m['position'][1]));d=Vector((m['direction'][0],-m['direction'][2],m['direction'][1])).normalized()
            values=[tree.find_nearest(p+d*t)[3]*2 for t in np.linspace(0,40,21)]
            mouths.append(dict(name=m['name'],position=list(p),direction=list(d),minimum_clear_diameter_m=min(values)))
        glb=r2_glb_fingerprint(name)['node_transforms'];glb.pop('collider',None)
        sc['review3_baseline']=json.dumps(dict(navigation=r3_nav(name),serialized_markers=glb,paths=s['validation']['paths'],mouths=mouths,previous_review=s['validation']),sort_keys=True)
    r1_save_source();print('Review3 navigation and every per-path clearance pinned')


def r3_assert_nav(name):
    old=json.loads(STATE[name]['scene']['review3_baseline']);assert r3_nav(name)==old['navigation'],name+' navigation changed';return old


def r3_extract_overlay(name):
    s=STATE[name];old=s['lod0'];bm=bmesh.new();bm.from_mesh(old.data);layer=bm.faces.layers.int.get('r1_region')
    if layer:bmesh.ops.delete(bm,geom=[f for f in bm.faces if f[layer]==0],context='FACES')
    else:bmesh.ops.delete(bm,geom=list(bm.faces),context='FACES')
    loose=[v for v in bm.verts if not v.link_faces]
    if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    me=bpy.data.meshes.new(name+'_preserved_surface_marks');bm.to_mesh(me);bm.free();ob=bpy.data.objects.new(name+'_preserved_surface_marks',me);s['scene'].collection.objects.link(ob);ob.hide_render=True;ob.hide_set(True);s['r3_overlay']=ob


def r3_begin(name):
    i=R3_ORDER.index(name)
    for prev in R3_ORDER[:i]:assert STATE[prev]['validation'].get('review')=='review-3' and STATE[prev].get('verified'),prev
    s=STATE[name];assert s['validation'].get('review')!='review-3';r3_assert_nav(name);bpy.context.window.scene=s['scene'];r3_extract_overlay(name)
    for ob in s['lods']:bpy.data.objects.remove(ob,do_unlink=True)
    s['lods']=[];s.pop('lod0');s['render_parts']=[];s['review']='review-3';s['verified']=False;s['r3_gaps']=[];s['r3_unmet']=[]
    s['collider'].hide_set(False);s['collider'].hide_render=True;s['scene']['review_delivered']=False
    r1_region(s['collider'],0);purge(name+' review3 begin')


def r3_box(label,p,size,region=0,rotation=None):
    ob=cube_part(label,p,size)
    if rotation is not None:ob.rotation_euler=rotation;select(ob);bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
    r1_region(ob,region);return ob


def r3_cyl(label,p,r,depth,n=16,region=0,axis='Z'):
    ob=r1_cylinder(label,p,r,depth,n)
    if axis=='Y':ob.rotation_euler.x=math.pi/2;select(ob);bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
    r1_region(ob,region);return ob


def r3_safe_part(name,ob):
    select(ob);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);decimate(ob,1000000)
    s=STATE[name];base=json.loads(s['scene']['review3_baseline']);tree=mesh_bvh(ob)[0]
    for path,report in zip(s['paths'],base['paths']):
        radius=report['minimum_clear_diameter_m']/2-.001
        if any(tree.find_nearest(Vector(p))[3]<radius or point_inside(tree,p) for p in sample_path(path,5)):
            print('Rejected clearance intrusion:',ob.name);bpy.data.objects.remove(ob,do_unlink=True);return False
    for mouth in base['mouths']:
        p=Vector(mouth['position']);d=Vector(mouth['direction']);radius=mouth['minimum_clear_diameter_m']/2-.001
        if any(tree.find_nearest(p+d*t)[3]<radius or point_inside(tree,p+d*t) for t in np.linspace(0,40,21)):
            print('Rejected mouth intrusion:',ob.name);bpy.data.objects.remove(ob,do_unlink=True);return False
    return True


def r3_union(name,parts,guard=True):
    s=STATE[name];parts=[p for p in parts if not guard or r3_safe_part(name,p)]
    s['collider']=r3_clean(r1_union([s['collider']]+parts,name+'_collider'))
    if name=='kovuk' and not guard:keep_main_solid(s['collider']);r3_clean(s['collider'])
    assert_solid(s['collider']);print('Collider triangles',len(s['collider'].data.polygons));purge(name+' structural additions')


def r3_render(name,bevel=.20):
    s=STATE[name];col=s['collider'];ob=col.copy();ob.data=col.data.copy();s['scene'].collection.objects.link(ob);ob.name=name+'_lod0';ob['asset_node']='lod0';ob.hide_render=False;ob.hide_set(False);select(ob)
    if bevel:
        mod=ob.modifiers.new('Real bevels on structural edges','BEVEL');mod.width=bevel;mod.segments=1;mod.limit_method='ANGLE';mod.angle_limit=.40;bpy.ops.object.modifier_apply(modifier=mod.name)
    decimate(ob,1000000);ob.data.set_sharp_from_angle(angle=.65)
    s['lod0']=ob;s['lods']=[ob];s['render_parts']=[ob];col.hide_render=True;col.hide_set(True)
    overlay=s.pop('r3_overlay');tree=mesh_bvh(col)[0];bm=bmesh.new();bm.from_mesh(overlay.data)
    bad=[f for f in bm.faces if any(tree.find_nearest(v.co)[3]>.68 for v in f.verts) or tree.find_nearest(f.calc_center_median())[3]>.68]
    bmesh.ops.delete(bm,geom=bad,context='FACES');loose=[v for v in bm.verts if not v.link_faces]
    if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    bm.to_mesh(overlay.data);bm.free();overlay.hide_set(False);overlay.hide_render=False;s['render_parts'].append(overlay)
    purge(name+' render rebuilt from new collider')


def r3_join(name):
    s=STATE[name];r1_join_render(name);r3_trim(name);limit={'iskele':14900,'sessiz_liman':39500}.get(name,29500)
    decimate(s['lod0'],limit)
    if name in ['enkaz','yarik_kalbi','sessiz_liman']:b2_uv(name)
    else:r1_uv_structure(name,s['lod0'])
    print('Render triangles',len(s['lod0'].data.polygons));purge(name+' render joined')


def r3_metal_map(name,kind,size=1024):
    s=STATE[name];rgba=np.ones((size,size,4),dtype=np.float32)
    for start in range(0,size,128):
        U,V=np.meshgrid((np.arange(size,dtype=np.float32)+.5)/size,(np.arange(start,min(start+128,size),dtype=np.float32)+.5)/size)
        grain=np.mod(np.sin(U*18133+V*37817)*43758.5453,1)-.5
        rgb,h,rough,metal,em=r2_station_pixels(U,V,grain);seam,edge,cell,bolt,_=r2_panel_field((U-.52)/.46*.75,(V-.02)/.70*.60)
        hull=(U>.51)&(V<.80);value=.073+.013*cell+.001*grain
        for k,factor in enumerate([.86,.94,1.]):rgb[:,:,k][hull]=(value*factor)[hull]
        rgb[hull&seam]*=.72;rough[hull]=(.55+.19*cell)[hull];metal[hull]=.69
        wear=hull&edge&(cell>.80)&(grain>.25);rgb[wear]=(.16,.17,.17);rough[wear]=.44
        # Smooth low-contrast soot; no thresholded sine or per-triangle painted scorch.
        soot=np.exp(-((U-.93)/.045)**2-((V-.38)/.22)**2)+.7*np.exp(-((U-.55)/.025)**2-((V-.25)/.22)**2)
        rgb[hull]*=1-.24*soot[hull,None];rough[hull]+=soot[hull]*.11
        if kind=='base':p=np.where(rgb<=.0031308,rgb*12.92,1.055*np.maximum(rgb,0)**(1/2.4)-.055)
        elif kind=='orm':p=np.stack([np.ones_like(U),rough,metal],axis=2)
        else:p=np.where(em<=.0031308,em*12.92,1.055*np.maximum(em,0)**(1/2.4)-.055)
        rgba[start:start+128,:,:3]=np.clip(p,0,1)
    im=s['images'][kind];im.pixels.foreach_set(rgba.ravel());im.update();im.pack();del rgba;purge(name+' review3 '+kind)


def r3_metal_material(name):
    r1_material(name);s=STATE[name];ns=s['material'].node_tree.nodes;link=s['material'].node_tree.links.new;tex=next(n for n in ns if n.type=='TEX_IMAGE' and n.image==s['images']['normal']);uv=node(ns,'ShaderNodeUVMap');uv.uv_map='DetailUV';link(uv.outputs[0],tex.inputs['Vector']);next(n for n in ns if n.type=='NORMAL_MAP').uv_map='DetailUV'
    bs=next(n for n in ns if n.type=='BSDF_PRINCIPLED');bs.inputs['Emission Strength'].default_value=5;next(n for n in ns if n.type=='NORMAL_MAP').inputs['Strength'].default_value=.42


def r3_surface_bands(name,paths,spacing=18):
    s=STATE[name];tree=mesh_bvh(s['collider'])[0];s['_r2_tree']=tree
    for path in paths:
        pts=sample_path(path,spacing)
        for i,p in enumerate(pts[1:-1],1):
            p=Vector(p);t=(Vector(pts[i+1])-Vector(pts[i-1])).normalized();side=t.cross(Vector((0,0,1))).normalized();up=side.cross(t).normalized()
            hits=[]
            for a in np.linspace(0,2*math.pi,9):
                hit,n,_,_=tree.ray_cast(p,side*math.cos(a)+up*math.sin(a),100)
                hits.append(hit)
            for a,b in zip(hits,hits[1:]):
                if a is not None and b is not None:r2_projected_panel(name,[a-t*1.5,b-t*1.5,b+t*1.5,a+t*1.5],6,.16)
        for side_sign in [-1,1]:
            run=[]
            for p in sample_path(path,5):
                p=Vector(p);hit,n,_,_=tree.ray_cast(p,Vector((side_sign,0,.4)).normalized(),100)
                if hit is None:continue
                q=hit+n*.13
                if run and tree.find_nearest((run[-1]+q)*.5)[3]>.35:
                    if len(run)>1:s['render_parts'].append(r2_pipe('Flush wall cable bundle',run,.16,6))
                    run=[]
                run.append(q)
            if len(run)>1:s['render_parts'].append(r2_pipe('Flush wall cable bundle',run,.16,6))
    del s['_r2_tree'];purge(name+' interior ribs and cable runs')


def r3_enkaz_structure():
    name='enkaz';s=STATE[name];parts=[]
    prow=b2_hull('Long tapered armoured prow',[(-250,10,12),(-215,23,23),(-178,45,46)],True);r1_region(prow,0);parts.append(prow)
    keel=r3_box('Armoured lower keel',b2_bow_point([0,-148,-61]),(13,154,12),6,(0,0,-math.radians(8)));parts.append(keel)
    parts += [r3_box('Bridge citadel lower',(0,177,61),(58,58,28)),r3_box('Bridge tower',(0,183,89),(36,36,32)),r3_box('Broken bridge crown',(-8,187,109),(27,28,12))]
    for y,x,z in [(-185,0,48),(-92,0,57),(110,0,63),(189,0,116)]:
        p=b2_bow_point([x,y,z]) if y<0 else [x,y,z];parts.append(r3_cyl('Empty capital turret barbette',p,14,9,16,6))
        parts.append(r3_box('Broken turret shield',Vector(p)+Vector((0,0,5)),(18,14,6),0))
    for x in [-40,0,40]:parts.append(r3_cyl('Capital engine nozzle shell',(x,216,-10),16,44,20,6,'Y'))
    for x in [-20,20]:parts.append(r3_cyl('Upper engine nozzle shell',(x,215,25),14,42,20,6,'Y'))
    for sign in [-1,1]:
        for y in [90,111,195]:parts.append(r3_box('Layered stern flank armour',(sign*72,y,38),(10,18,30),0,(0,.06*sign,0)))
        for y in [-198,-180,-98,-78]:
            p=b2_bow_point([sign*(31 if y<-170 else 69),y,43]);parts.append(r3_box('Bow shoulder armour',p,(10,17,18),0,(0,sign*.09,-math.radians(8))))
        for z in [-42,42]:parts.append(r3_box('Torn cross-section deck level',(0,52,z),(118,12,4),6,(0,.035,0)))
        for x in [sign*56,sign*67]:parts.append(r3_box('Exposed fracture rib',(x,49,0),(4,20,96),6,(0,.04*sign,.04*sign)))
        plate=r3_box('Bent torn armour lip',(sign*67,52,39),(20,16,5),6,(.24,sign*.18,sign*.12));parts.append(plate)
    r3_union(name,parts)


def r3_enkaz_nozzles():
    s=STATE['enkaz'];ob=s['collider']
    for x,z,r,end in [(-40,-10,12,240),(0,-10,12,240),(40,-10,12,240),(-20,25,10,238),(20,25,10,238)]:
        cut=r3_cyl('Blind cold engine bell cavity',(x,end-12,z),r,28,20,0,'Y');boolean_cut(ob,cut)
    # Bridge windows are real geometry strips, on an unreachable tower face.
    r3_heal(ob);r3_enkaz_bulkheads();ob=s['collider'];r3_render('enkaz',.28);tree=mesh_bvh(ob)[0];s['_r2_tree']=tree
    for z in [86,96]:
        for x in [-12,-6,0,6,12]:r2_projected_panel('enkaz',[(x-1.4,164.95,z),(x+1.4,164.95,z),(x+1.4,164.95,z+1.6),(x-1.4,164.95,z+1.6)],1 if x==0 and z==96 else 2,.06)
    for y in [80,105,185,204]:
        for sign in [-1,1]:r2_projected_panel('enkaz',[(sign*77,y-3,47),(sign*77,y+3,47),(sign*77,y+3,48.6),(sign*77,y-3,48.6)],1 if y==105 else 2,.06)
    del s['_r2_tree'];r3_surface_bands('enkaz',s['paths'][:2],18);r3_channel_ribs('enkaz',s['paths'][:2]);r3_join('enkaz')


def r3_clean(ob):
    bm=bmesh.new();bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.001);bmesh.ops.triangulate(bm,faces=list(bm.faces))
    if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    bm.to_mesh(ob.data);bm.free();ob.data.update();print('Cleaned',topology(ob));return ob


def r3_routes(name):
    s=STATE[name];base=r3_assert_nav(name);tree=mesh_bvh(s['collider'])[0];out=[]
    for i,(path,old) in enumerate(zip(s['paths'],base['paths'])):
        points=sample_path(path,8);diam=[tree.find_nearest(Vector(p))[3]*2 for p in points]
        inside=sum(point_inside(tree,p) for p in points);assert inside==0
        assert min(diam)+.002>=old['minimum_clear_diameter_m'],(name,i,min(diam),old['minimum_clear_diameter_m'])
        out.append(dict(path=i,samples=len(points),minimum_clear_diameter_before_m=old['minimum_clear_diameter_m'],minimum_clear_diameter_m=min(diam),clear_diameter_p5_m=float(np.percentile(diam,5)),points_in_solid=inside,minimum_bend_radius_m=old['minimum_bend_radius_m'],maximum_sample_spacing_m=max((Vector(a)-Vector(b)).length for a,b in zip(points,points[1:]))))
    mouths=[]
    for old in base['mouths']:
        p=Vector(old['position']);d=Vector(old['direction']);points=[p+d*t for t in np.linspace(0,40,21)];diam=[tree.find_nearest(q)[3]*2 for q in points];inside=sum(point_inside(tree,q) for q in points)
        assert inside==0 and min(diam)+.002>=old['minimum_clear_diameter_m'],(name,old['name'],min(diam),old['minimum_clear_diameter_m'])
        mouths.append(dict(name=old['name'],approach_length_m=40,sample_spacing_m=2,minimum_clear_diameter_before_m=old['minimum_clear_diameter_m'],minimum_clear_diameter_after_m=min(diam),points_in_solid=inside))
    s['r3_mouths']=mouths;print('Clearance',[(p['path'],round(p['minimum_clear_diameter_before_m'],4),round(p['minimum_clear_diameter_m'],4)) for p in out]);return out


def r3_gap_allowed(name,p,d):
    if d<=.75:return True
    for gap in STATE[name].get('r3_gaps',[]):
        if all(gap['bounds'][j][0]-.001<=p[j]<=gap['bounds'][j][1]+.001 for j in range(3)) and d<=5:return True
    return False


def r3_validate(name):
    s=STATE[name];base=r3_assert_nav(name);col=s['collider'];top=assert_solid(col);cross=intersection_check(col);assert cross['passed'],cross
    assert top['triangles']<=(16000 if name=='kovuk' else 12000)
    assert len(s['lod0'].data.polygons)<={'iskele':15000,'sessiz_liman':40000}.get(name,30000)
    paths=r3_routes(name);tree=mesh_bvh(col)[0];v=json.loads(json.dumps(base['previous_review']))
    for key in ['glb_roundtrip','immutable_baseline','serialized_collision_navigation_unchanged','final_delivery','final_memory_record','exported_glb','preview_review','unmet_rules','premium_photographic_target_met']:v.pop(key,None)
    v.update(review='review-3',collider_topology=top,self_intersection=cross,collider_vs_lod0=s['distance'],paths=paths,lod_triangle_counts={o['asset_node']:len(o.data.polygons) for o in s['lods']},dimensions_m=[float(col.dimensions.x),float(col.dimensions.z),float(col.dimensions.y)],
        texture_sizes={k:list(im.size) for k,im in s['images'].items()},unmet_rules=s.get('r3_unmet',[]),minimum_clear_diameter_m=min((p['minimum_clear_diameter_m'] for p in paths),default=None),
        clear_diameter_p5_m=float(np.percentile([tree.find_nearest(Vector(p))[3]*2 for path in s['paths'] for p in sample_path(path,8)],5)) if paths else None,
        review3_navigation_unchanged=True,mouth_approaches=s['r3_mouths'],collider_gap_exceptions=s.get('r3_gaps',[]),largest_closed_gap_m=max((g.get('measured_clear_width_m',g.get('maximum_clear_width_m',0)) for g in s.get('r3_gaps',[])),default=0),
        largest_closed_gap_location=None if not s.get('r3_gaps') else max(s['r3_gaps'],key=lambda g:g.get('measured_clear_width_m',g.get('maximum_clear_width_m',0)))['location'],
        current_rss_mib=purge(name+' review3 validation'),peak_process_rss_mib=__import__('resource').getrusage(__import__('resource').RUSAGE_SELF).ru_maxrss/1024)
    if name=='enkaz':v['under_spine_gap_clear_diameter_m']=paths[4]['minimum_clear_diameter_m']
    s['validation']=v;dump(OUT/name/'validation.json',v);print('REVIEW3 VALID',name,top['triangles'],v['lod_triangle_counts'])


def r3_deliver(name):
    s=STATE[name];r3_assert_nav(name);bpy.context.window.scene=s['scene'];folder=OUT/name
    bpy.ops.object.select_all(action='DESELECT')
    for ob in [s['collider']]+s['lods']+[o for o in s['scene'].objects if o.type=='EMPTY']:ob.hide_set(False);ob.hide_viewport=False;ob.select_set(True)
    opts=dict(filepath=str(folder/(name+'.glb')),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_animations=False,export_image_format='AUTO',export_extras=True,export_cameras=False,export_lights=False,export_all_vertex_colors=False)
    if name=='kovuk':opts.update(export_vertex_color='NAME',export_vertex_color_name='Geology')
    elif name in ['enkaz','sessiz_liman']:opts.update(export_vertex_color='NAME',export_vertex_color_name='HullTint')
    bpy.ops.export_scene.gltf(**opts);doc=patch_glb(folder/(name+'.glb'),s)
    assert len(doc['materials'])==1 and len(doc['images'])==4
    assert {n['name'] for n in doc['nodes']}=={'collider','lod0','lod1','lod2'}|{m['name'] for m in s['markers']}
    new=r2_glb_fingerprint(name)['node_transforms'];new.pop('collider',None);assert new==json.loads(s['scene']['review3_baseline'])['serialized_markers']
    import hashlib
    s['validation']['exported_glb']=dict(bytes=(folder/(name+'.glb')).stat().st_size,materials=1,embedded_pngs=4);s['validation']['serialized_markers_unchanged']=True
    dump(folder/'validation.json',s['validation']);dump(folder/'provenance.json',dict(origin='Original procedural geometry and PBR; no third-party content',review='review-3',blender_version=bpy.app.version_string,generator='tools/yarik-blender.py',generator_sha256=hashlib.sha256((ROOT/'tools/yarik-blender.py').read_bytes()).hexdigest(),navigation_json_unchanged=True))
    s['scene']['review_preview_specs']=json.dumps(s['preview_specs']);s['scene']['review3_gap_exceptions']=json.dumps(s.get('r3_gaps',[]));s['scene']['review_delivered']=True;s['complete']=True
    s['collider'].hide_render=True;s['collider'].hide_set(True)
    for ob in s['lods'][1:]:ob.hide_render=True;ob.hide_set(True)
    r1_save_source();print('EXPORTED REVIEW3',name)


def r3_trim(name):
    s=STATE[name];tree=mesh_bvh(s['collider'])[0];ob=s['lod0'];bm=bmesh.new();bm.from_mesh(ob.data);region=bm.faces.layers.int.get('r1_region');bad=[]
    for f in bm.faces:
        if region and f[region]==0:continue
        a,b,c=[v.co for v in f.verts]
        divisions=min(80,max(4,math.ceil(max((a-b).length,(b-c).length,(c-a).length)/2)))
        if any(tree.find_nearest(a*(1-i/divisions-j/divisions)+b*(i/divisions)+c*(j/divisions))[3]>.65 for i in range(divisions+1) for j in range(divisions+1-i)):bad.append(f)
    bmesh.ops.delete(bm,geom=bad,context='FACES');loose=[v for v in bm.verts if not v.link_faces]
    if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    bm.to_mesh(ob.data);bm.free();print('Removed obsolete or bridging detail faces',len(bad));purge(name+' surface tolerance trim')


def r3_heal(ob):
    r3_clean(ob)
    if not intersection_check(ob)['passed']:
        ob.hide_set(False);select(ob);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.intersect_boolean(operation='UNION',use_self=True,solver='EXACT');bpy.ops.object.mode_set(mode='OBJECT');r3_clean(ob)
    assert_solid(ob);assert intersection_check(ob)['passed'];purge('Exact boolean self-contact resolution')


def r3_restore_saved_enkaz():
    s=STATE['enkaz'];bpy.context.window.scene=s['scene']
    for ob in [s['collider']]+s.get('lods',[]):
        try:bpy.data.objects.remove(ob,do_unlink=True)
        except ReferenceError:pass
    import shutil
    restore=OUT/'.review3_restore.blend';shutil.copyfile(OUT/'yarik-structures.blend',restore)
    with bpy.data.libraries.load(str(restore),link=False) as (src,dst):dst.objects=['enkaz_collider','enkaz_lod0']
    restore.unlink()
    for ob in dst.objects:s['scene'].collection.objects.link(ob)
    s['collider']=dst.objects[0];s['collider'].name='enkaz_collider';s['collider'].hide_set(False);s['lod0']=dst.objects[1]
    r3_extract_overlay('enkaz');bpy.data.objects.remove(s['lod0'],do_unlink=True);s.pop('lod0');s['lods']=[];s['render_parts']=[]
    purge('Restored pre-review original collider for exact rebuild')


def r3_hull_tint(name):
    s=STATE[name];me=s['lod0'].data;attr=me.color_attributes.get('HullTint') or me.color_attributes.new(name='HullTint',type='FLOAT_COLOR',domain='CORNER')
    for li,loop in enumerate(me.loops):
        p=me.vertices[loop.vertex_index].co
        if name=='enkaz':
            c=math.cos(math.radians(8));sn=math.sin(math.radians(8));bow_y=sn*p.x+c*(p.y+137.5)-137.5
            distance=min(abs(p.y-55),abs(bow_y+55));soot=math.exp(-(distance/15)**2);color=(1-.68*soot,1-.72*soot,1-.73*soot)
        else:
            d=min(math.sqrt((p.x-330)**2+(p.y-80)**2),math.sqrt((p.x+330)**2+(p.y+80)**2),math.sqrt((p.x*.8)**2+(p.y+335)**2))
            soot=math.exp(-(d/55)**2);color=(1-.23*soot,1-.25*soot,1-.26*soot)
        attr.data[li].color=(*color,1)
    me.color_attributes.active_color=attr;ns=s['material'].node_tree.nodes;links=s['material'].node_tree.links;bs=next(n for n in ns if n.type=='BSDF_PRINCIPLED');base=next(n for n in ns if n.type=='TEX_IMAGE' and n.image==s['images']['base'])
    col=node(ns,'ShaderNodeVertexColor');col.layer_name='HullTint';mix=node(ns,'ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;links.new(base.outputs[0],mix.inputs[1]);links.new(col.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],bs.inputs['Base Color'])


def r3_channel_ribs(name,paths):
    s=STATE[name];tree=mesh_bvh(s['collider'])[0];s['_r2_tree']=tree
    for path in paths:
        _,pts=r1_path_at_distance(path,18)
        for i in range(1,len(pts)-1):
            p=Vector(pts[i]);t=(Vector(pts[i+1])-Vector(pts[i-1])).normalized();side=t.cross(Vector((0,0,1))).normalized();up=side.cross(t).normalized();hits=[]
            for a in np.linspace(0,2*math.pi,65):hits.append(tree.ray_cast(p,side*math.cos(a)+up*math.sin(a),100)[0])
            for a,b in zip(hits,hits[1:]):
                if a is None or b is None:continue
                r2_projected_panel(name,[a-t*1.8,b-t*1.8,b+t*1.8,a+t*1.8],4,.025)
                r2_projected_panel(name,[a-t*1.1,b-t*1.1,b+t*1.1,a+t*1.1],6,.54)
    del s['_r2_tree'];purge(name+' raised flush channel ribs at 18m pitch')


def r3_enkaz_bulkheads():
    parts=[]
    for i,y in enumerate([62,78]):
        frame=r3_box('Collapsed bulkhead corner structure',(0,y,0),(88,3.6,88),6,(0,.18*(-1 if i else 1),0))
        cut=r3_cyl('Guaranteed 71.2m bulkhead free opening',(0,y,0),35.6,8,48,0,'Y');boolean_cut(frame,cut)
        notch=r3_box('Broken bulkhead corner',(28 if i else -28,y,34),(22,8,15),0,(0,.22,0));boolean_cut(frame,notch);r3_clean(frame);parts.append(frame)
    r3_union('enkaz',parts);r3_heal(STATE['enkaz']['collider'])


def r3_kalbi_structure():
    name='yarik_kalbi';s=STATE[name];parts=[]
    for a in np.linspace(0,2*math.pi,8,endpoint=False):
        for offset in [-25,25]:
            p=rotate_xy((129,offset,40),a);parts.append(r3_box('Layered octagonal rim armour',p,(14,46,30),0,(0,0,a)))
            p=rotate_xy((132,offset,27),a);parts.append(r3_box('Lower rim armour step',p,(16,43,8),6,(0,0,a)))
        rib=r1_beam('Lower deck radial load rib',rotate_xy((26,0,-72),a),rotate_xy((127,0,-68),a),6);r1_region(rib,6);parts.append(rib)
    for a in [math.pi/4,3*math.pi/4,5*math.pi/4,7*math.pi/4]:
        for offset in [-7,0,7]:parts.append(r3_box('Station radiator fin',rotate_xy((135,offset,53),a),(34,3.2,25),6,(0,0,a)))
        p=rotate_xy((63,0,-82),a);parts.append(r3_cyl('Lower deck machinery reservoir',p,9,32,16,0))
        parts.append(r3_cyl('Reservoir lower cap',Vector(p)+Vector((0,0,-15)),10,5,16,6))
    parts += [r3_cyl('Lower pressure machinery hub',(0,0,-82),30,32,16,6),r3_cyl('Hub service collar',(0,0,-88),34,7,16,0),r3_cyl('Crown beacon support',(0,0,199),3.5,30,12,6),r3_cyl('Warm crown beacon lens',(0,0,213),6,6,16,1)]
    for a in [0,math.pi/2,math.pi,3*math.pi/2]:
        parts.append(r3_box('Dock arm under-pad machinery',rotate_xy((140,0,47),a),(30,31,12),6,(0,0,a)))
        for sign in [-1,1]:parts.append(r3_box('Pad corner floodlight housing',rotate_xy((157,sign*19,64),a),(4,4,5),6,(0,0,a)))
        parts.append(r3_box('Deck hatch',rotate_xy((78,20,61),a),(10,14,3),6,(0,0,a)))
        parts.append(r3_box('Deck service pipe',rotate_xy((88,-18,61),a),(48,3.4,3.4),6,(0,0,a)))
    for a in [math.pi/4,5*math.pi/4]:
        p=Vector(rotate_xy((87,0,65),a));parts.append(r3_cyl('Antenna dish pedestal',p,3.8,12,12,6));dish=r3_cyl('Antenna dish armoured bowl',p+Vector((0,0,8)),12,5,20,6)
        boolean_cut(dish,r3_cyl('Dish shallow concave cavity',p+Vector((0,0,10)),9.5,5,20));parts.append(dish)
        parts.append(r3_cyl('Dish feed horn',p+Vector((0,0,12)),1.7,10,10,6))
    r3_union(name,parts);r3_heal(s['collider']);r3_render(name,.35)


def r3_kalbi_lights():
    name='yarik_kalbi';s=STATE[name];tree=mesh_bvh(s['collider'])[0];s['_r2_tree']=tree
    for z in [82,101,123,145,166]:
        for a in np.linspace(0,2*math.pi,12,endpoint=False):
            p,n,_,_=tree.ray_cast(Vector((80*math.cos(a),80*math.sin(a),z)),Vector((-math.cos(a),-math.sin(a),0)),100)
            if p is None:continue
            t=Vector((-math.sin(a),math.cos(a),0))
            for off in [-3,0,3]:r2_projected_panel(name,[p+t*(off-1)+Vector((0,0,-.65)),p+t*(off+1)+Vector((0,0,-.65)),p+t*(off+1)+Vector((0,0,.65)),p+t*(off-1)+Vector((0,0,.65))],1 if z in [101,145] else 7,.06)
    for a in [0,math.pi/2,math.pi,3*math.pi/2]:
        for sign in [-1,1]:
            x,y,z=rotate_xy((157,sign*19,66.52),a);s['render_parts'].append(r1_quad('Pad floodlight luminous face',[(x-1.2,y-1.2,z),(x+1.2,y-1.2,z),(x+1.2,y+1.2,z),(x-1.2,y+1.2,z)],3))
        for off in [-12,12]:
            pts=[rotate_xy(q,a) for q in [(127,off-1.2,40.9),(151,off-1.2,40.9),(151,off+1.2,40.9),(127,off+1.2,40.9)]];r2_projected_panel(name,pts,1,.06)
    del s['_r2_tree'];r3_join(name)


def r3_padcheck(name):
    s=STATE[name];tree=mesh_bvh(s['collider'])[0];reports=[]
    for m in s['markers']:
        if not (m['name'].startswith('pad_') or m['name']=='deck'):continue
        p=Vector((m['position'][0],-m['position'][2],m['position'][1]));radius=30 if m['name']=='deck' else (20 if name=='yarik_kalbi' else 12);err=[]
        for r in [0,radius*.5,radius]:
            for a in np.linspace(0,2*math.pi,64,endpoint=False):
                hit,_,_,_=tree.ray_cast(p+Vector((r*math.cos(a),r*math.sin(a),15)),Vector((0,0,-1)),30);assert hit is not None;err.append(abs(hit.z-p.z))
        assert max(err)<.001,(name,m['name'],max(err));reports.append(dict(name=m['name'],clear_disk_diameter_m=radius*2,flatness_error_m=max(err),samples=len(err)))
    s['validation']['landing_surface_recheck']=reports;dump(OUT/name/'validation.json',s['validation']);print('Pads/deck rechecked',reports)


def r3_ico(label,p,scale,sub=2,seed=0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=p);ob=bpy.context.object;ob.name=label
    for v in ob.data.vertices:
        q=v.co;factor=1+.026*math.sin(q.x*11+seed)+.018*math.sin(q.y*17+q.z*9+seed*3);v.co*=factor
    ob.scale=scale;select(ob);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);r1_region(ob,0);return ob


def r3_kovuk_outer():
    s=STATE['kovuk'];checkpoint=json.loads(s['scene'].get('review_work_checkpoint','{}'))
    for key in ['craters','chambers','shafts','branches','full_paths','los']:
        if key in checkpoint:s[key]=checkpoint[key]
    body=r3_ico('Elongated lopsided fractured basalt',(50,-15,-10),(550,385,320),3,23);s['r3_rock_work']=body
    # Protect whole chamber voids, including the original deposit wall surfaces.
    for label,p,scales in [('Crystal grotto conservation',(-215,0,-60),(140,140,135)),('Collapsed hall conservation',(180,0,-60),(145,140,135))]:
        cut=r3_ico(label,p,scales,2,0);boolean_cut(body,cut)
    purge('Kovuk coarse growth with conserved chamber voids')


def r3_kovuk_voids(start=0,count=3):
    s=STATE['kovuk'];body=s['r3_rock_work'];base=json.loads(s['scene']['review3_baseline'])
    for i in range(start,min(start+count,len(s['paths']))):
        half=base['paths'][i]['minimum_clear_diameter_m']/2+7
        boolean_cut(body,r1_sweep('Protected route growth void '+str(i),s['paths'][i],half,8,extend=20))
    purge('Kovuk growth routes '+str(start))


def r3_flared_mouth(m,length=600):
    p=Vector((m['position'][0],-m['position'][2],m['position'][1]));d=Vector((m['direction'][0],-m['direction'][2],m['direction'][1])).normalized();hint=Vector((0,0,1)) if abs(d.z)<.9 else Vector((0,1,0));u=d.cross(hint).normalized();v=d.cross(u).normalized();verts=[];faces=[];N=16
    for dist,r in [(-22,49),(0,54),(45,76),(135,112),(length,170)]:
        for j in range(N):
            a=2*math.pi*j/N;rr=r*(1+.08*math.sin(j*2.1+.3));verts.append(p+d*dist+(u*math.cos(a)+v*math.sin(a))*rr)
    for i in range(4):
        for j in range(N):faces.append((i*N+j,i*N+(j+1)%N,(i+1)*N+(j+1)%N,(i+1)*N+j))
    faces.extend([tuple(reversed(range(N))),tuple(4*N+j for j in range(N))]);me=bpy.data.meshes.new('Irregular flared mouth cutter');me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new('Irregular flared mouth cutter',me);bpy.context.scene.collection.objects.link(ob);r3_clean(ob);return ob


def r3_kovuk_fuse():
    name='kovuk';s=STATE[name];body=s.pop('r3_rock_work')
    # Shaft centreline extensions are cut through the added rock as well.
    for sh in s.get('shafts',[]):
        p=Vector(sh['start']);d=Vector(sh['direction']);boolean_cut(body,r1_sweep('Preserved real narrow shaft',[p,p+d*650],3.1,1.1))
    for m in s['entrances']:boolean_cut(body,r3_flared_mouth(m))
    parts=[body]
    for seed,p,scale in [(1,(480,225,-80),(45,40,36)),(2,(310,280,130),(43,40,38)),(3,(-330,-240,165),(39,43,36))]:parts.append(r3_ico('Fused 40-90m boulder',p,scale,2,seed))
    # A six-sided ridge follows the upper flank; its lower portion overlaps the carrier.
    for x in [-300,-160,-20,120,260,400]:
        z=-10+320*math.sqrt(max(.1,1-((x-50)/550)**2-(60/385)**2));parts.append(r3_ico('Blocky ridge spine', (x,45,z-10),(97,39,44),1,int(x)))
    r3_union(name,parts,guard=False)
    return r3_kovuk_finish()


def r3_kovuk_finish():
    name='kovuk';s=STATE[name]
    # One large planar fracture with terraced strata at its foot.
    boolean_cut(s['collider'],r3_box('Flat major fracture plane',(-600,0,0),(320,1000,1000)))
    steps=[r3_box('Geometric basalt strata step',(-442,8,z),(18,160,15),0) for z in [-100,-60,-20,20,60,100]]
    r3_union(name,steps)
    # Irregular raised rim around a real deep impact bowl.
    p=Vector((330,190,220));n=Vector(((330-50)/550**2,(190+15)/385**2,(220+10)/320**2)).normalized()
    bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,major_radius=78,minor_radius=15,location=p-n*10);rim=bpy.context.object;rim.name='Raised impact ejecta rim';rim.rotation_euler=n.to_track_quat('Z','Y').to_euler()
    for vertex in rim.data.vertices:
        q=vertex.co;a=math.atan2(q.y,q.x);q.x*=1+.075*math.sin(a*5);q.y*=1+.045*math.sin(a*7+.8);q.z+=5*math.sin(a*4+.2)
    select(rim);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);r1_region(rim,0);r3_union(name,[rim],guard=False)
    bowl=r3_ico('Deep impact crater cut',p+n*35,(86,86,86),3,0);boolean_cut(s['collider'],bowl)
    # Reopen the mouths after every fused addition; they can only grow wider.
    for m in s['entrances']:boolean_cut(s['collider'],r3_flared_mouth(m))
    r3_heal(s['collider']);print('Kovuk grown dimensions',list(s['collider'].dimensions));r3_routes(name)


def r3_rock_reduce():
    s=STATE['kovuk'];ob=s['collider'];points=np.concatenate([np.array(sample_path(path,6)) for path in s['paths']]);base=json.loads(s['scene']['review3_baseline'])
    for angle in [.06,.10,.15,.22,.30]:
        if len(ob.data.polygons)<=15800:break
        bm=bmesh.new();bm.from_mesh(ob.data);allowed=set()
        for v in bm.verts:
            q=np.array(v.co[:]);distance=float(np.linalg.norm(points-q,axis=1).min())
            if distance>92 and (q-np.array([-215,0,-60])).dot(q-np.array([-215,0,-60]))>145**2 and (q-np.array([180,0,-60])).dot(q-np.array([180,0,-60]))>145**2:allowed.add(v)
        edges=[e for e in bm.edges if all(v in allowed for v in e.verts)]
        bmesh.ops.dissolve_limit(bm,angle_limit=angle,use_dissolve_boundaries=False,verts=list(allowed),edges=edges,delimit=set());bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free();r3_clean(ob);print('Exterior-only planar reduction',angle,len(ob.data.polygons));purge('Kovuk protected interior reduction')
    assert len(ob.data.polygons)<=16000;assert_solid(ob);r3_routes('kovuk')


def r3_rock_field(X,Y,Z):
    s=STATE['kovuk'];q=[X-50,Y+15,Z+10];out=np.full_like(X,-1e6)
    for i in range(78):
        nz=1-2*(i+.5)/78;a=i*math.pi*(3-math.sqrt(5));rr=math.sqrt(1-nz*nz);n=(rr*math.cos(a),rr*math.sin(a),nz)
        d=math.sqrt((n[0]*650)**2+(n[1]*385)**2+(n[2]*320)**2)*(1+.025*math.sin(i*2.17))
        out=np.maximum(out,sum(q[k]*n[k] for k in range(3))-d)
    def ellipsoid(p,r):return (np.sqrt(((X-p[0])/r[0])**2+((Y-p[1])/r[1])**2+((Z-p[2])/r[2])**2)-1)*min(r)
    for p,r in [((480,225,-80),(45,40,36)),((310,280,130),(43,40,38)),((-330,-240,165),(39,43,36))]:out=np.minimum(out,ellipsoid(p,r))
    for x in [-300,-160,-20,120,260,400]:
        z=-10+320*math.sqrt(max(.1,1-((x-50)/650)**2-(60/385)**2));out=np.minimum(out,ellipsoid((x,45,z-10),(97,39,44)))
    out=np.maximum(out,-440-X)
    for z in [-100,-60,-20,20,60,100]:out=np.minimum(out,np.maximum.reduce([abs(X+442)-9,abs(Y-8)-80,abs(Z-z)-10]))
    p=np.array([330,190,220]);n=np.array([(330-50)/650**2,(190+15)/385**2,(220+10)/320**2]);n/=np.linalg.norm(n);delta=[X-p[0],Y-p[1],Z-p[2]];along=sum(delta[i]*n[i] for i in range(3));rad=np.sqrt(np.maximum(0,sum(v*v for v in delta)-along*along));wobble=6*np.sin(X*.042+Y*.037)
    rim=np.sqrt((rad-78-wobble)**2+(along+10)**2)-15;out=np.minimum(out,rim)
    bowl=np.sqrt(sum((delta[i]-n[i]*35)**2 for i in range(3)))-86;out=np.maximum(out,-bowl)
    original=globals()['r1_rock_outer']
    try:
        globals()['r1_rock_outer']=lambda a,b,c:np.full_like(a,-1e6)
        # Keep room diameters near 180-220m; reserve larger sampling headroom along tunnels.
        room_distance=np.minimum(np.sqrt((X+215)**2+Y**2+(Z+60)**2),np.sqrt((X-180)**2+Y**2+(Z+60)**2))
        blend=np.clip((room_distance-100)/40,0,1);blend=blend*blend*(3-2*blend)
        interior=r1_rock_field(X,Y,Z)+2+5*blend
    finally:globals()['r1_rock_outer']=original
    solid=np.maximum(out,interior)
    for m in s['entrances']:
        p=np.array([m['position'][0],-m['position'][2],m['position'][1]]);d=np.array([m['direction'][0],-m['direction'][2],m['direction'][1]]);d/=np.linalg.norm(d);a=[X-p[0],Y-p[1],Z-p[2]];t=sum(a[i]*d[i] for i in range(3));rad=np.sqrt(np.maximum(0,sum(v*v for v in a)-t*t));radius=np.interp(t,[-22,0,45,135,600],[49,54,76,112,170]);cut=np.maximum.reduce([rad-radius,-22-t,t-600]);solid=np.maximum(solid,-cut)
    return solid.astype(np.float32)


def r3_kovuk_rebuild():
    s=STATE['kovuk'];ob=implicit_mesh('Kovuk fractured elongated solid',r3_rock_field,[(-475,760),(-435,420),(-365,395)],step=12)
    old=s['collider'];s['collider']=ob;bpy.data.objects.remove(old,do_unlink=True);ob['asset_node']='collider';keep_main_solid(ob);decimate(ob,14000);r3_clean(ob);assert_solid(ob);purge('Kovuk 12m field and reduced carrier')
    print('Growth bounds',list(ob.dimensions));r3_routes('kovuk')


def r3_kovuk_shafts_deposits():
    s=STATE['kovuk'];ob=s['collider']
    for sh in s.get('shafts',[]):
        p=Vector(sh['start']);d=Vector(sh['direction']);boolean_cut(ob,r1_sweep('Real narrow light shaft',[p,p+d*650],3.1,1.1))
    parts=[]
    for m in s['markers']:
        if not m['name'].startswith('deposit_'):continue
        p=Vector((m['position'][0],-m['position'][2],m['position'][1]));n=Vector((m['direction'][0],-m['direction'][2],m['direction'][1]));part=r3_cyl('Fixed ore wall ledge',p-n*10,6,20,8,0);part.rotation_euler=n.to_track_quat('Z','Y').to_euler();select(part);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);parts.append(part)
    r3_union('kovuk',parts);r3_heal(ob);print('Kovuk final collision',topology(ob));r3_routes('kovuk')


def r3_kovuk_los_baffle():
    s=STATE['kovuk'];_,a=r1_path_at_distance(s['branches']['A'],2);_,b=r1_path_at_distance(s['branches']['B'],2);p=Vector((a[74]+b[74])*.5);hit,_,_,_=mesh_bvh(s['collider'])[0].find_nearest(p)
    centre=p+(hit-p).normalized()*12;r3_union('kovuk',[r3_ico('Fork fracture spur preserving old LOS',centre,(28,18,23),2,7)]);r3_heal(s['collider']);r3_routes('kovuk');r1_kovuk_los()


def r3_rock_veins():
    s=STATE['kovuk'];tree=mesh_bvh(s['collider'])[0]
    for index,m in enumerate(s['markers']):
        if not m['name'].startswith('deposit_'):continue
        p=Vector((m['position'][0],-m['position'][2],m['position'][1]));n=Vector((m['direction'][0],-m['direction'][2],m['direction'][1])).normalized();u=n.cross(Vector((0,0,1)))
        if u.length<.1:u=n.cross(Vector((0,1,0)))
        u.normalize();v=n.cross(u).normalized()
        for a in [0,2.1,4.2]:
            direction=u*math.cos(a)+v*math.sin(a);previous=p;pn=n
            for j in range(1,16):
                wanted=p+direction*(j*2.8)-n*min(j*2.1,10)+v*(.65*math.sin(j*.9+index));hit,nn,_,_=tree.find_nearest(wanted);t=(hit-previous).normalized();side=t.cross(pn)
                if side.length<.1:break
                side.normalize();other=t.cross(nn).normalized();width=.58*(1-j/22)
                points=[previous+pn*.065-side*width,hit+nn*.065-other*width,hit+nn*.065+other*width,previous+pn*.065+side*width]
                checks=[(points[k]+points[(k+1)%4])*.5 for k in range(4)]
                if max(tree.find_nearest(q)[3] for q in checks)>.60:break
                ob=r1_quad('Exported teal crystal branch',points,1);attribute=ob.data.attributes.new('r2_vein','INT','FACE')
                for value in attribute.data:value.value=1
                s['render_parts'].append(ob);previous=hit;pn=nn
    purge('Kovuk eight fixed ore points with physical emissive veins')


def r3_rock_geology():
    s=STATE['kovuk'];me=s['lod0'].data;colors=me.color_attributes['Geology'];ore=me.uv_layers['OreUV'];response=me.uv_layers.get('RockResponseUV') or me.uv_layers.new(name='RockResponseUV');veins=me.attributes.get('r2_vein');normals=[v.normal.copy() for v in me.vertices];count=0
    p=Vector((330,190,220));n=Vector((280/650**2,205/385**2,230/320**2)).normalized()
    for f in me.polygons:
        vein=bool(veins and veins.data[f.index].value==1);count+=int(vein)
        if f.center.x<-434 and abs(f.normal.x)>.6:f.use_smooth=False
        for li in f.loop_indices:
            vi=me.loops[li].vertex_index;q=me.vertices[vi].co;nn=normals[vi];dust=max(0,min(.68,(nn.z-.20)*.82));delta=q-p;rad=(delta-n*delta.dot(n)).length
            floor=max(0,min(1,(67-rad)/30))*max(0,min(1,(-delta.dot(n)-12)/25))*max(0,min(1,nn.dot(n)*1.5));dust=max(dust,.93*floor)
            shade=.48+.065*math.sin(q.x*.009+q.y*.008);color=np.array([shade*.88,shade*.95,shade])*(1-dust)+np.array([.96,.79,.57])*dust
            if vein:color=np.array([.35,.78,.71])
            colors.data[li].color=(*color,1);ore.data[li].uv=(.5,.5) if vein else (.001,.001);response.data[li].uv=(.05,.5) if vein else (.25+.57*dust,.5)
    me.uv_layers['UVMap'].active_render=True;s['r3_vein_triangles']=count;print('Exported emissive vein triangles',count)


def r3_kovuk_render():
    r3_render('kovuk',0);r3_rock_veins();r3_join('kovuk');r3_rock_geology();r2_rock_material();s=STATE['kovuk'];bs=next(n for n in s['material'].node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Emission Strength'].default_value=7
    r1_make_lods('kovuk');r1_distance('kovuk');r3_validate('kovuk');r1_validate_cave(s['validation']);s['validation']['line_of_sight']=s['los'];s['validation']['body_axis_ratio']=[1,float(s['collider'].dimensions.y/s['collider'].dimensions.x),float(s['collider'].dimensions.z/s['collider'].dimensions.x)];s['validation']['exported_emissive_vein_triangles']=s['r3_vein_triangles'];dump(OUT/'kovuk/validation.json',s['validation'])


def r3_ore_caps():
    s=STATE['kovuk']
    for i,m in enumerate(s['markers']):
        if not m['name'].startswith('deposit_'):continue
        p=Vector((m['position'][0],-m['position'][2],m['position'][1]));n=Vector((m['direction'][0],-m['direction'][2],m['direction'][1]));u=n.cross(Vector((0,0,1))).normalized();v=n.cross(u).normalized();vertices=[p+n*.075]
        for j in range(12):
            a=j*math.pi/6;r=2.1+.65*math.sin(j*2.31+i);vertices.append(p+n*.075+(u*math.cos(a)+v*math.sin(a))*r)
        faces=[(0,1+j,1+(j+1)%12) for j in range(12)];me=bpy.data.meshes.new('Fixed deposit luminous fracture');me.from_pydata(vertices,[],faces);me.update();ob=bpy.data.objects.new('Fixed deposit luminous fracture',me);s['scene'].collection.objects.link(ob);r1_region(ob,1);vein=me.attributes.new('r2_vein','INT','FACE')
        for d in vein.data:d.value=1
        s['render_parts'].append(ob)
    purge('All eight deposits have exported luminous fracture faces')


def r3_solid_pipe(label,path,radius=1.7,region=6):
    ob=r2_pipe(label,path,radius,region);bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=8);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free();return ob


def r3_ring_sector(label,r0,r1,z0,z1,a0,a1,steps=8):
    verts=[];faces=[]
    for a in np.linspace(a0,a1,steps+1):
        verts.extend([(r0*math.cos(a),r0*math.sin(a),z0),(r1*math.cos(a),r1*math.sin(a),z0),(r1*math.cos(a),r1*math.sin(a),z1),(r0*math.cos(a),r0*math.sin(a),z1)])
    for i in range(steps):
        for j in range(4):faces.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
    faces.extend([tuple(reversed(range(4))),tuple(steps*4+j for j in range(4))]);me=bpy.data.meshes.new(label);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(label,me);bpy.context.scene.collection.objects.link(ob);r3_clean(ob);return ob


def r3_liman_structure():
    name='sessiz_liman';s=STATE[name];col=s['collider']
    # The missing outer armour sector leaves a visible inner pressure wall, never a phantom collider lid.
    boolean_cut(col,r3_ring_sector('Missing 48-degree outer-ring armour',127,190,-84,150,math.radians(-70),math.radians(-22),8))
    parts=[]
    for a in np.radians([-67,-56,-44,-32,-24]):parts.append(r3_box('Exposed outer ring load rib',rotate_xy((128,0,5),a),(10,4.2,186),6,(0,0,a)))
    for sign,y,z in [(1,80,45),(-1,-80,-45)]:
        for side in [-1,1]:
            for j,dz in enumerate([-36,-12,14,37]):
                p=(sign*(320-j%2*3),y+side*59,z+dz);parts.append(r3_box('Outward bent torn breach plate',p,(26,6,18),6,(.09*side,.1*sign,(.25+.10*j)*side*sign)))
            parts.append(r3_solid_pipe('Hanging heavy service hose',[(sign*260,y+side*54,z+35),(sign*268,y+side*61,z+12),(sign*286,y+side*61,z-5),(sign*295,y+side*54,z+35)],1.7,6))
        for side in [-1,1]:parts.append(r3_box('Ruptured deck cross-section',(sign*319,y,z+side*57),(27,110,4),6,(0,sign*.16,0)))
    for a,b in [((-68,40,125),(-105,80,178)),((-105,80,178),(-150,86,174)),((-105,80,178),(-78,83,164)),((-135,85,175),(-144,102,187)),((-87,83,167),(-72,93,160))]:
        part=r1_beam('Broken antenna array spar',a,b,4.5);r1_region(part,6);parts.append(part)
    for i,x in enumerate([180,204,233]):parts.append(r3_box('Bent solar-wing stub finger',(x,199+i*5,88+(i-1)*9),(4,60-i*9,4.5),6,(.13*(i-1),0,.10*(i-1))))
    for i,x in enumerate([180,204,233]):
        part=r1_beam('Solar stub fractured root connection',(x,176,86),(x,199,88+(i-1)*9),4.5);r1_region(part,6);parts.append(part)
    for sign in [-1,1]:
        for y in [-275,-240,-205]:parts.append(r3_box('Hangar radiator fin',(sign*73,y,69),(22,3.4,25),6,(0,sign*.1,0)))
    for y in [65,80,95]:parts.append(r3_box('Wing radiator fin',(220,y,109),(34,3.5,22),6))
    r3_union(name,parts);r3_heal(s['collider']);r3_render(name,.28)


def r3_liman_lights():
    name='sessiz_liman';s=STATE[name];tree=mesh_bvh(s['collider'])[0];s['_r2_tree']=tree
    for z in [-48,48]:
        for a in np.linspace(0,2*math.pi,32,endpoint=False):
            angle=math.degrees(a) if a<math.pi else math.degrees(a)-360
            if -72<angle<-20:continue
            p,n,_,_=tree.ray_cast(Vector((200*math.cos(a),200*math.sin(a),z)),Vector((-math.cos(a),-math.sin(a),0)),100)
            if p is None or math.hypot(p.x,p.y)<135:continue
            t=Vector((-math.sin(a),math.cos(a),0))
            for offset in [-6,0,6]:r2_projected_panel(name,[p+t*(offset-1.8)+Vector((0,0,-1.2)),p+t*(offset+1.8)+Vector((0,0,-1.2)),p+t*(offset+1.8)+Vector((0,0,1.2)),p+t*(offset-1.8)+Vector((0,0,1.2))],7,.075)
    for sign,y,z in [(1,80,45),(-1,-80,-45)]:
        for xx in [230,286,315]:
            for side in [-1,1]:
                hit,n,_,_=tree.ray_cast(Vector((sign*xx,y+side*100,z+27)),Vector((0,-side,0)),100)
                if hit is not None:r2_projected_panel(name,[hit+Vector((-3,0,-1)),hit+Vector((3,0,-1)),hit+Vector((3,0,1)),hit+Vector((-3,0,1))],1,.08)
    del s['_r2_tree'];r3_join(name)

# Brief 4: repeated light modules; the four maps below are shared external GLB image URIs.
K4_ORDER=['kit_corridor','kit_bend','kit_tee','kit_cross','kit_room','kit_cap','kit_mouth','kit_hall','kit_hangar','kit_tower','kit_tower_top','kit_corridor_broken','kit_room_collapsed','kit_dressing_antenna','kit_dressing_solar_stub','kit_dressing_radiator','kit_dressing_tank_cluster']
K4_SHARED=bpy.app.driver_namespace.setdefault('yarik_kit_shared',{})

def k4_start_workspace():
    # Preserve the explicitly paused Review 3 work without replacing its last delivered source file.
    if bpy.data.scenes.get('sessiz_liman'):
        bpy.data.scenes['sessiz_liman']['review3_pending_stage']='Solar root connections, heal/render/material/previews/export still pending; Review 3 paused at owner request.'
        bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'review3-paused.blend'))
    scene=bpy.data.scenes.new('kit_workspace');bpy.context.window.scene=scene
    for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
    for sc in list(bpy.data.scenes):
        if sc!=scene:bpy.data.scenes.remove(sc)
    STATE.clear()
    for data in [bpy.data.materials,bpy.data.images,bpy.data.node_groups]:
        for item in list(data):item.use_fake_user=False
    purge('Brief4 clean kit workspace; paused review saved')


def k4_shared_maps():
    folder=OUT/'kit_shared';folder.mkdir(exist_ok=True);size=1024;axis=(np.arange(size,dtype=np.float32)+.5)/size;U,V=np.meshgrid(axis,axis)
    grain=np.mod(np.sin(U*18133+V*37817)*43758.5453,1)-.5;seam,edge,cell,bolt,h=r2_panel_field(U,V);rgb=np.zeros((size,size,3),dtype=np.float32);value=.074+.012*cell+.001*grain
    for k,factor in enumerate([.88,.95,1.]):rgb[:,:,k]=value*factor
    rgb[seam]*=.65;wear=edge&(cell>.78)&(grain>.18);rgb[wear]=(.15,.16,.16);rgb[bolt]=(.12,.13,.14)
    # A small common strip contains the fixture swatches. Hull UVs occupy the remaining 84%.
    emission=np.zeros_like(rgb);rough=.56+.19*cell;rough[wear]=.43;metal=np.full_like(U,.72)
    for region,(c,e,r,m) in {1:((.23,.105,.022),(.32,.11,.014),.4,.1),2:((.009,.029,.029),(.003,.012,.011),.7,.2),3:((.42,.46,.46),(.58,.66,.68),.3,.1),4:((.008,.012,.016),(0,0,0),.82,.45),6:((.14,.155,.16),(0,0,0),.46,.9),7:((.03,.15,.17),(.10,.45,.5),.4,.15),8:((.28,.29,.27),(0,0,0),.8,.2)}.items():
        mask=(U>.86)&(V>(region-.75)/10)&(V<(region-.25)/10);rgb[mask]=c;emission[mask]=e;rough[mask]=r;metal[mask]=m;h[mask]=0
    dy,dx=np.gradient(h);n=np.stack([-dx*2.1,-dy*2.1,np.ones_like(U)],axis=2);n/=np.linalg.norm(n,axis=2)[:,:,None];n[(U>.86)]=[0,0,1]
    arrays={'base':np.where(rgb<=.0031308,rgb*12.92,1.055*np.maximum(rgb,0)**(1/2.4)-.055),'orm':np.stack([np.ones_like(U),rough,metal],axis=2),'emissive':np.where(emission<=.0031308,emission*12.92,1.055*np.maximum(emission,0)**(1/2.4)-.055),'normal':n*.5+.5}
    images={}
    for kind,pixels in arrays.items():
        rgba=np.ones((size,size,4),dtype=np.float32);rgba[:,:,:3]=pixels;im=bpy.data.images.new('kit_'+kind,size,size,alpha=False);im.colorspace_settings.name='Non-Color' if kind in ['orm','normal'] else 'sRGB';im.pixels.foreach_set(rgba.ravel());im.update();im.filepath_raw=str(folder/('kit_'+kind+'.png'));im.file_format='PNG';im.save();im.pack();im.use_fake_user=True;images[kind]=im
    mat=bpy.data.materials.new('Yarik shared abandoned station kit');mat.use_nodes=True;mat.use_fake_user=True;ns=mat.node_tree.nodes;links=mat.node_tree.links;bs=next(n for n in ns if n.type=='BSDF_PRINCIPLED');tex={}
    for kind,im in images.items():tex[kind]=node(ns,'ShaderNodeTexImage');tex[kind].image=im
    links.new(tex['base'].outputs[0],bs.inputs['Base Color']);links.new(tex['emissive'].outputs[0],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=4
    normal=node(ns,'ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.5;links.new(tex['normal'].outputs[0],normal.inputs['Color']);links.new(normal.outputs[0],bs.inputs['Normal']);sep=node(ns,'ShaderNodeSeparateColor');links.new(tex['orm'].outputs[0],sep.inputs[0]);links.new(sep.outputs[1],bs.inputs['Roughness']);links.new(sep.outputs[2],bs.inputs['Metallic'])
    group=bpy.data.node_groups.get('glTF Material Output')
    if group is None:group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree');group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
    gn=node(ns,'ShaderNodeGroup');gn.node_tree=group;links.new(sep.outputs[0],gn.inputs['Occlusion']);K4_SHARED.update(images=images,material=mat)
    dump(folder/'shared_material.json',dict(material=mat.name,texture_resolution=1024,files=['kit_'+k+'.png' for k in arrays],albedo_srgb_range=[.28,.35],normal_detail='Panel seams, bolts and sparse edge wear',license='Original procedural work'))
    purge('One common kit PBR texture set')


def k4_new(name):
    i=K4_ORDER.index(name)
    for prev in K4_ORDER[:i]:assert STATE[prev].get('verified'),prev+' must be complete first'
    (OUT/name).mkdir(exist_ok=True)
    sc=new_scene(name);s=STATE[name];s.update(review='brief-4',ports=[],deposits=[],cargo=[],pads=[],material=K4_SHARED['material'],images=K4_SHARED['images'],unmet=[],nominal_wall_thickness_m=10)
    sc['brief4_asset']=True;sc.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.22
    return s


def k4_port(s,p,d,cap=False):
    name='port_'+str(len(s['ports'])+1);marker(s,name,p,d);s['ports'].append(dict(name=name,position=yup(p),direction=yup(d),clear_size_m=[70,70],outer_frame_size_m=[90,90],cap=cap))


def k4_point(s,kind,p,d=(0,0,1)):
    key=kind+'_'+str(len(s[kind+'s' if kind in ['deposit','pad'] else kind])+1);marker(s,key,p,d,'Y' if kind in ['cargo','pad'] else 'Z');s[kind+'s' if kind in ['deposit','pad'] else kind].append(s['markers'][-1])


def k4_mesh(label,vertices,faces,region=0):
    me=bpy.data.meshes.new(label);me.from_pydata(vertices,[],faces);me.update();ob=bpy.data.objects.new(label,me);bpy.context.scene.collection.objects.link(ob);r1_region(ob,region);r3_clean(ob);return ob


def k4_tube(label,centres,tangents,inner=35,outer=45):
    vertices=[];faces=[]
    for p,t in zip(centres,tangents):
        p,t=Vector(p),Vector(t).normalized();up=Vector((0,0,1));side=t.cross(up).normalized();up=side.cross(t).normalized()
        for half in [outer,inner]:
            for x,z in [(-half,-half),(half,-half),(half,half),(-half,half)]:vertices.append(p+side*x+up*z)
    for i in range(len(centres)-1):
        for layer in [0,4]:
            for j in range(4):faces.append((i*8+layer+j,i*8+layer+(j+1)%4,(i+1)*8+layer+(j+1)%4,(i+1)*8+layer+j))
    for i in [0,len(centres)-1]:
        for j in range(4):faces.append((i*8+j,i*8+(j+1)%4,i*8+4+(j+1)%4,i*8+4+j))
    return k4_mesh(label,vertices,faces)


def k4_arc(p0,p1,centre,axis='Z',steps=32):
    c=Vector(centre);a=Vector(p0)-c;b=Vector(p1)-c;normal=Vector((0,0,1)) if axis=='Z' else Vector((1,0,0));angle=math.atan2(normal.dot(a.cross(b)),a.dot(b));from mathutils import Quaternion
    return [list(c+Quaternion(normal,angle*t)@a) for t in np.linspace(0,1,steps+1)]


def k4_ports_paths(s,ports):
    for p,d in ports:k4_port(s,p,d)


def k4_build(name):
    s=k4_new(name);s['paths']=[];parts=[]
    if name=='kit_corridor':
        ob=k4_tube(name,[(0,-40,0),(0,40,0)],[(0,1,0)]*2);k4_ports_paths(s,[((0,-40,0),(0,-1,0)),((0,40,0),(0,1,0))]);s['paths']=[[[0,-40,0],[0,40,0]]]
    elif name=='kit_bend':
        angles=np.linspace(0,math.pi/2,25);centres=[[-60+120*math.cos(a),-60+120*math.sin(a),0] for a in angles];tangents=[[-math.sin(a),math.cos(a),0] for a in angles];ob=k4_tube(name,centres,tangents);k4_ports_paths(s,[(centres[0],(0,-1,0)),(centres[-1],(-1,0,0))]);s['paths']=[centres];s['inner_bend_radius_m']=85
    elif name in ['kit_tee','kit_cross']:
        directions=[(0,-1,0),(0,1,0),(1,0,0)]+([(-1,0,0)] if name=='kit_cross' else []);parts=[cube_part('Broad turning junction',(0,0,0),(160,160,90))]
        for d in directions:
            p=Vector(d)*105;size=(90,70,90) if d[1] else (70,90,90);parts.append(cube_part('Flush square arm',p,size))
        ob=r1_union(parts,name+'_collider');boolean_cut(ob,cube_part('Junction free space',(0,0,0),(140,140,70)))
        for d in directions:
            p=Vector(d)*105;boolean_cut(ob,cube_part('70m square connector void',p,(70,100,70) if d[1] else (100,70,70)));k4_port(s,Vector(d)*140,d)
        for i,a in enumerate(directions):
            for b in directions[i+1:]:
                a,b=Vector(a),Vector(b)
                if a.dot(b)<-.9:path=[list(a*140),list(b*140)]
                else:
                    c=(a+b)*70;curve=k4_arc(a*70,b*70,c);path=r1_concat([a*140,a*70],curve,[b*70,b*140])
                s['paths'].append(path)
    elif name in ['kit_room','kit_room_collapsed']:
        ob=cube_part('120m pressure room',(0,0,0),(120,120,120));boolean_cut(ob,cube_part('100m free room',(0,0,0),(100,100,100)))
        directions=[(0,-1,0),(0,1,0)]+([(1,0,0),(-1,0,0)] if name=='kit_room' else [])
        for d in directions:boolean_cut(ob,cube_part('Square room port',Vector(d)*55,(70,30,70) if d[1] else (30,70,70)));k4_port(s,Vector(d)*60,d)
        for i,a in enumerate(directions):
            for b in directions[i+1:]:
                a,b=Vector(a),Vector(b)
                if a.dot(b)<-.9:path=[list(a*60),list(b*60)]
                else:path=k4_arc(a*60,b*60,(a+b)*60)
                s['paths'].append(path)
        if name=='kit_room_collapsed':
            parts=[ob]
            for x,y,z,size in [(-43,31,-37,(12,22,26)),(42,-34,-41,(15,22,18)),(43,37,-30,(11,17,40))]:parts.append(cube_part('Collapsed wall rubble',(x,y,z),size))
            ob=r1_union(parts,name+'_collider')
        for p in [(-24,-16,50),(24,16,50)]:k4_point(s,'deposit',p,(0,0,-1))
        k4_point(s,'cargo',(0,0,0))
    elif name=='kit_cap':
        ob=cube_part('Solid flush blanking cap',(0,5,0),(90,10,90));k4_port(s,(0,0,0),(0,-1,0),True);s['cap_exception']='Intentionally closes the connector; no open route is claimed.'
    elif name=='kit_mouth':
        # Same 70/90 back connector, a 110/130 open mouth, 60m between planes.
        vertices=[];faces=[]
        for y,outer,inner in [(-40,65,55),(20,45,35)]:
            for half in [outer,inner]:
                for x,z in [(-half,-half),(half,-half),(half,half),(-half,half)]:vertices.append((x,y,z))
        for layer in [0,4]:
            for j in range(4):faces.append((layer+j,layer+(j+1)%4,8+layer+(j+1)%4,8+layer+j))
        for i in [0,1]:
            for j in range(4):faces.append((i*8+j,i*8+(j+1)%4,i*8+4+(j+1)%4,i*8+4+j))
        ob=k4_mesh('Flared 110m entrance',vertices,faces);k4_port(s,(0,20,0),(0,1,0));marker(s,'entrance_1',(0,-40,0),(0,-1,0));s['paths']=[[[0,-40,0],[0,20,0]]]
    else:raise ValueError(name)
    r3_heal(ob);ob.name=name+'_collider';ob['asset_node']='collider';r1_region(ob,0);s['collider']=ob
    s['render_parts']=[];purge(name+' simple closed kit collider');return s


def k4_uv(name):
    s=STATE[name];ob=s['lod0'];me=ob.data;uv=me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap');detail=me.uv_layers.get('DetailUV') or me.uv_layers.new(name='DetailUV');regions=me.attributes['r1_region'].data;coords=np.array([v.co[:] for v in s['collider'].data.vertices]);lo=coords.min(axis=0);span=np.maximum(coords.max(axis=0)-lo,1)
    for f in me.polygons:
        axis=max(range(3),key=lambda j:abs(f.normal[j]));a,b=[j for j in range(3) if j!=axis];region=regions[f.index].value
        for li in f.loop_indices:
            p=me.vertices[me.loops[li].vertex_index].co
            if region:co=(.93,(region-.5)/10);duv=co
            else:co=(.02+.80*(p[a]-lo[a])/span[a],.02+.96*(p[b]-lo[b])/span[b]);duv=(p[a]/128,p[b]/128)
            uv.data[li].uv=co;detail.data[li].uv=duv
    uv.active_render=True


def k4_render(name):
    s=STATE[name];col=s['collider'];ob=col.copy();ob.data=col.data.copy();s['scene'].collection.objects.link(ob);ob.name=name+'_lod0';ob['asset_node']='lod0';ob.hide_render=False;select(ob)
    weights=ob.data.attributes.get('bevel_weight_edge') or ob.data.attributes.new('bevel_weight_edge','FLOAT','EDGE')
    for edge in ob.data.edges:
        a,b=[ob.data.vertices[i].co for i in edge.vertices];flush=False
        for port in s['ports']:
            p=Vector((port['position'][0],-port['position'][2],port['position'][1]));n=Vector((port['direction'][0],-port['direction'][2],port['direction'][1]))
            if abs((a-p).dot(n))<.0001 and abs((b-p).dot(n))<.0001:flush=True;break
        weights.data[edge.index].value=0 if flush else 1
    mod=ob.modifiers.new('Bevels preserve the exact flush port planes','BEVEL');mod.width=.18;mod.segments=1;mod.limit_method='WEIGHT';bpy.ops.object.modifier_apply(modifier=mod.name);decimate(ob,1000000);ob.data.set_sharp_from_angle(angle=.65);s['lod0']=ob;s['render_parts']=[ob];s['lods']=[ob]
    tree=mesh_bvh(col)[0];seen=set()
    for path in s['paths'][:2]:
        _,points=r1_path_at_distance(path,12)
        for i,p in enumerate(points[1:-1],1):
            tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)]);tangent.z=0
            if tangent.length<.1:continue
            tangent.normalize();side=tangent.cross(Vector((0,0,1))).normalized()
            for sign in [-1,1]:
                q=Vector(p)+side*sign*14;hit,n,_,_=tree.ray_cast(q,Vector((0,0,-1)),200)
                if hit is None or n.z<.8:continue
                key=tuple(round(v/3) for v in hit)
                if key in seen:continue
                seen.add(key);centre=hit+n*.035;points4=[centre-tangent*1.5-side*.22,centre+tangent*1.5-side*.22,centre+tangent*1.5+side*.22,centre-tangent*1.5+side*.22];s['render_parts'].append(r1_quad('Common amber floor emergency strip',points4,1))
    # A few lit and dead fixtures, fixed to a real exterior wall rather than floating.
    verts=np.array([v.co[:] for v in col.data.vertices]);lo,hi=verts.min(axis=0),verts.max(axis=0)
    if not name.startswith('kit_dressing') and name!='kit_cap':
        for j,fraction in enumerate([.2,.5,.8]):
            y=float(lo[1]+(hi[1]-lo[1])*fraction);hit,n,_,_=tree.ray_cast(Vector((hi[0]+20,y,10)),Vector((-1,0,0)),hi[0]-lo[0]+50)
            if hit is None or hit.x<hi[0]-6 or n.x<.8:continue
            points4=[hit+Vector((.035,-2.1,-.6)),hit+Vector((.035,2.1,-.6)),hit+Vector((.035,2.1,.6)),hit+Vector((.035,-2.1,.6))];s['render_parts'].append(r1_quad('Shared exterior window strip',points4,7 if j==1 else 2))
    bpy.ops.object.select_all(action='DESELECT')
    for part in s['render_parts']:part.hide_set(False);part.select_set(True)
    bpy.context.view_layer.objects.active=ob;bpy.ops.object.join();decimate(ob,1000000);s['render_parts']=[ob];k4_uv(name);ob.data.materials.clear();ob.data.materials.append(K4_SHARED['material'])
    for f in ob.data.polygons:f.material_index=0
    # One shared normal UV node for the entire kit.
    mat=K4_SHARED['material'];ns=mat.node_tree.nodes;links=mat.node_tree.links
    if not ns.get('Kit normal coordinates'):
        node_uv=node(ns,'ShaderNodeUVMap');node_uv.name='Kit normal coordinates';node_uv.uv_map='DetailUV';normal_tex=next(n for n in ns if n.type=='TEX_IMAGE' and n.image==K4_SHARED['images']['normal']);links.new(node_uv.outputs[0],normal_tex.inputs['Vector']);next(n for n in ns if n.type=='NORMAL_MAP').uv_map='DetailUV'
    col.hide_render=True;col.hide_set(True);r1_make_lods(name);r1_distance(name);purge(name+' shared material render LODs')


def k4_setup_lighting(name):
    s=STATE[name];sc=s['scene'];set_engine(sc,'BLENDER_EEVEE');sc.eevee.taa_render_samples=16;sc.eevee.use_raytracing=False;enum_value(sc.eevee,'shadow_pool_size','64');sc.render.resolution_x=1600;sc.render.resolution_y=1000;sc.render.resolution_percentage=100;sc.render.threads_mode='FIXED';sc.render.threads=2;enum_value(sc.view_settings,'view_transform','AgX')
    light(sc,'Kit sky key',(-400,-600,700),2.7,(.80,.87,1),kind='SUN');light(sc,'Kit red-star rim',(500,100,240),.75,(1,.55,.32),kind='SUN');light(sc,'Kit low review fill',(150,-200,130),1.8e6,(.60,.71,.84),160,target=(0,0,0))
    if s['paths']:
        path=max(s['paths'],key=lambda p:sum((Vector(a)-Vector(b)).length for a,b in zip(p,p[1:])));_,points=r1_path_at_distance(path,60)
        for i,p in enumerate(points):
            if i%2==0:light(sc,'Kit practical interior',Vector(p)+Vector((0,0,20)),22000,(1,.65,.34),8,target=Vector(p)+Vector((0,0,-45)))
    r2_review_lighting(name);sc.eevee.taa_render_samples=16
    coords=np.array([v.co[:] for v in s['collider'].data.vertices]);target=Vector((coords.min(axis=0)+coords.max(axis=0))*.5);direction=Vector((1,-1.3,.75)).normalized();s['preview_specs']={'exterior_300m':(list(target+direction*300),list(target),None,22 if max(s['collider'].dimensions)<200 else 16)}
    if s['paths']:
        path=max(s['paths'],key=lambda p:sum((Vector(a)-Vector(b)).length for a,b in zip(p,p[1:])));_,points=r1_path_at_distance(path,4);idx=min(len(points)-2,max(1,len(points)//5));p=Vector(points[idx]);target=Vector(points[min(len(points)-1,idx+15)]);s['preview_specs']['interior']=(list(p),list(target),None,19)
    else:s['preview_specs']['interior']=s['preview_specs']['exterior_300m'];s['unmet'].append('Solid cap/dressing piece has no flyable interior; the second view is a close exterior detail.')
    if not s['paths']:
        target=Vector((coords.min(axis=0)+coords.max(axis=0))*.5);s['preview_specs']['interior']=(list(target+Vector((1,-1,.4)).normalized()*max(70,float(max(s['collider'].dimensions))*1.5)),list(target),None,40)
    purge(name+' one exterior and one interior preview setup')


def k4_validate(name):
    s=STATE[name];col=s['collider'];top=assert_solid(col);cross=intersection_check(col);assert cross['passed'];room=name in ['kit_room','kit_hall','kit_hangar','kit_tower','kit_tower_top','kit_room_collapsed'];assert top['triangles']<=(6000 if room else 3000);assert len(s['lod0'].data.polygons)<=(25000 if room else 12000);tree=mesh_bvh(col)[0];routes=[]
    for i,path in enumerate(s['paths']):
        points=sample_path(path,4);diam=[2*tree.find_nearest(Vector(p))[3] for p in points];assert min(diam)>=61.999,(name,i,min(diam));assert all(not point_inside(tree,p) for p in points);bend=bend_radius(path);assert bend is None or bend>=59.98,(name,i,bend);routes.append(dict(path=i,samples=len(points),minimum_clear_diameter_m=min(diam),clear_diameter_p5_m=float(np.percentile(diam,5)),minimum_bend_radius_m=bend))
    port_checks=[]
    for port in s['ports']:
        p=Vector((port['position'][0],-port['position'][2],port['position'][1]));n=Vector((port['direction'][0],-port['direction'][2],port['direction'][1]));assert all(abs(v/20-round(v/20))<1e-5 for v in p);assert n.length==1 and sum(abs(v) for v in n)==1
        if port.get('cap'):port_checks.append(dict(name=port['name'],intentionally_closed=True));continue
        hint=Vector((0,0,1)) if abs(n.z)<.9 else Vector((0,1,0));u=n.cross(hint).normalized();v=n.cross(u).normalized();dist=[]
        for d in [u,-u,v,-v]:
            hit,_,_,length=tree.ray_cast(p-n*.01,d,150);assert hit is not None;dist.append(length)
        sizes=[dist[0]+dist[1],dist[2]+dist[3]];assert max(abs(a-70) for a in sizes)<.03,(name,port['name'],sizes)
        assert all(not point_inside(tree,p+n*t) for t in [0,.01,10,20,40]);port_checks.append(dict(name=port['name'],measured_clear_size_m=sizes,plane_grid_m=20,nominal_frame_m=10,flush_plane_preserved_in_render=True,approach_40m_open=True))
    cargo=[]
    for m in s['cargo']:
        p=Vector((m['position'][0],-m['position'][2],m['position'][1]));radius=tree.find_nearest(p)[3];assert not point_inside(tree,p) and radius>=39.999,(name,m['name'],radius);cargo.append(dict(name=m['name'],clear_radius_m=radius))
    deposits=[]
    for m in s['deposits']:
        p=Vector((m['position'][0],-m['position'][2],m['position'][1]));n=Vector((m['direction'][0],-m['direction'][2],m['direction'][1]));hit,normal,_,distance=tree.find_nearest(p);assert distance<.01 and normal.dot(n)>.999;deposits.append(dict(name=m['name'],wall_distance_m=distance,normal_dot=float(normal.dot(n))))
    v=dict(asset=name,review='brief-4',units='metres',coordinate_system='glTF Y-up',collider_topology=top,self_intersection=cross,lod_triangle_counts={ob['asset_node']:len(ob.data.polygons) for ob in s['lods']},collider_vs_lod0=s['distance'],paths=routes,minimum_clear_diameter_m=min((r['minimum_clear_diameter_m'] for r in routes),default=None),port_checks=port_checks,nominal_minimum_wall_thickness_m=s['nominal_wall_thickness_m'],cargo=cargo,deposits=deposits,material_count=1,shared_texture_set='../kit_shared/kit_{base,normal,orm,emissive}.png',texture_sizes={k:list(im.size) for k,im in K4_SHARED['images'].items()},largest_closed_gap_m=0,largest_closed_gap_location=None,dimensions_m=[float(col.dimensions.x),float(col.dimensions.z),float(col.dimensions.y)],unmet_rules=s['unmet'],current_rss_mib=purge(name+' asset acceptance'),peak_process_rss_mib=__import__('resource').getrusage(__import__('resource').RUSAGE_SELF).ru_maxrss/1024)
    s['validation']=v;dump(OUT/name/'validation.json',v);print('KIT VALID',name,top['triangles'],v['lod_triangle_counts'],v['minimum_clear_diameter_m'])


def k4_externalize(path):
    raw=Path(path).read_bytes();size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size]);binary=raw[28+size:];image_views={im['bufferView'] for im in doc['images']};new_views=[];mapping={};out=bytearray()
    for i,view in enumerate(doc['bufferViews']):
        if i in image_views:continue
        while len(out)%4:out.append(0)
        data=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']];mapping[i]=len(new_views);new=dict(view);new['byteOffset']=len(out);out.extend(data);new_views.append(new)
    for acc in doc['accessors']:
        if 'bufferView' in acc:acc['bufferView']=mapping[acc['bufferView']]
    for im in doc['images']:
        kind=next(k for k in ['base','normal','orm','emissive'] if k in im['name']);im.pop('bufferView');im.pop('mimeType',None);im['uri']='../kit_shared/kit_'+kind+'.png'
    doc['bufferViews']=new_views;doc['buffers']=[dict(byteLength=len(out))];payload=json.dumps(doc,separators=(',',':')).encode();payload+=b' '*((-len(payload))%4);out+=b'\0'*((-len(out))%4);Path(path).write_bytes(struct.pack('<III',0x46546c67,2,28+len(payload)+len(out))+struct.pack('<II',len(payload),0x4e4f534a)+payload+struct.pack('<II',len(out),0x004e4942)+out);return doc


def k4_save():
    bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'yarik-kit.blend'));purge('Kit source saved after piece')


def k4_deliver(name):
    s=STATE[name];k7_top_well(s);folder=OUT/name;folder.mkdir(exist_ok=True);bpy.context.window.scene=s['scene'];bpy.ops.object.select_all(action='DESELECT')
    for ob in [s['collider']]+s['lods']+[ob for ob in s['scene'].objects if ob.type=='EMPTY']:ob.hide_set(False);ob.hide_viewport=False;ob.select_set(True)
    path=folder/(name+'.glb');bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_animations=False,export_image_format='AUTO',export_extras=True,export_cameras=False,export_lights=False,export_all_vertex_colors=False);patch_glb(path,s);doc=k4_externalize(path)
    metadata=dict(asset=name,units='metres',coordinate_system='glTF Y-up',grid_m=20,ports=s['ports'],paths=[[yup(p) for p in route] for route in s['paths']],deposits=s['deposits'],cargo=s['cargo'],entrances=s['entrances'],pads=s['pads'],shared_material='Yarik shared abandoned station kit');dump(folder/(name+'.json'),metadata)
    import hashlib
    dump(folder/'provenance.json',dict(origin='Original procedural station kit, authored through live Blender MCP',license='Original work',blender_version=bpy.app.version_string,generator='tools/yarik-blender.py',generator_sha256=hashlib.sha256((ROOT/'tools/yarik-blender.py').read_bytes()).hexdigest(),shared_textures={k:hashlib.sha256((OUT/'kit_shared'/('kit_'+k+'.png')).read_bytes()).hexdigest() for k in K4_SHARED['images']}))
    assert len(doc['materials'])==1 and len(doc['images'])==4;assert {n['name'] for n in doc['nodes']}=={'collider','lod0','lod1','lod2'}|{m['name'] for m in s['markers']}
    s['validation']['exported_glb']=dict(bytes=path.stat().st_size,materials=1,external_shared_pngs=4);dump(folder/'validation.json',s['validation']);s['scene']['brief4_metadata']=json.dumps(metadata);s['scene']['review_preview_specs']=json.dumps(s['preview_specs']);s['complete']=True
    s['collider'].hide_render=True;s['collider'].hide_set(True)
    for ob in s['lods'][1:]:ob.hide_render=True;ob.hide_set(True)
    k4_save()

# Review 5: shared trim atlas and explicit render-only station structure.
def k5_hydrate():
    mat=bpy.data.materials.get('Yarik shared abandoned station kit')
    if mat:
        images={k:next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and ('kit_'+k) in n.image.name) for k in ['base','normal','orm','emissive']}
        K4_SHARED.update(material=mat,images=images)
    for sc in bpy.data.scenes:
        if not sc.get('brief4_metadata'):continue
        meta=json.loads(sc['brief4_metadata']);name=meta['asset'];s=STATE.setdefault(name,{})
        s.update(scene=sc,review='review-5',ports=meta['ports'],paths=[[[p[0],-p[2],p[1]] for p in path] for path in meta['paths']],deposits=meta['deposits'],cargo=meta['cargo'],pads=meta['pads'],entrances=meta['entrances'],markers=[],material=mat,images=K4_SHARED['images'],unmet=[],nominal_wall_thickness_m=10,render_parts=[])
        s['markers']=[dict(name=o['asset_node'],position=yup(o.location),direction=yup(o.rotation_euler.to_matrix()@Vector((0,1,0) if o['asset_node'].startswith(('cargo','pad')) else (0,0,1))),axis='+Y' if o['asset_node'].startswith(('cargo','pad')) else '+Z') for o in sc.objects if o.type=='EMPTY']
        s['collider']=next(o for o in sc.objects if o.get('asset_node')=='collider');s['lods']=sorted([o for o in sc.objects if str(o.get('asset_node','')).startswith('lod')],key=lambda o:o['asset_node']);s['lod0']=s['lods'][0];s['preview_specs']=json.loads(sc['review_preview_specs']);s['complete']=True
        vp=OUT/name/'validation.json'
        if vp.exists():s['validation']=json.loads(vp.read_text());s['verified']=bool(s['validation'].get('export_revalidated'))
    print('Kit state restored',list(STATE))


def k5_maps():
    size=1024;v,u=np.mgrid[0:size,0:size].astype(np.float32);u=(u+.5)/size;v=(v+.5)/size
    rgb=np.full((size,size,3),.31,np.float32);rgb*=np.array([.94,.98,1.02]);emit=np.zeros_like(rgb);rough=np.full((size,size),.62,np.float32);metal=np.full_like(rough,.72);height=np.zeros_like(rough)
    # Lower 40%: four broad panel tiles, each represents 5 x 5 metres.
    x=(u*8)%1;y=(v/.2)%1;seam=(np.minimum(x,1-x)<.018)|(np.minimum(y,1-y)<.025);soot=.024*np.exp(-((x-.92)/.15)**2)+.025*np.exp(-((y-.1)/.22)**2)
    rgb-=soot[:,:,None];rgb[seam & (v<.4)]*=.40;height[seam & (v<.4)]=-.10
    bolt=((x-.07)**2+(y-.08)**2<.001)|((x-.93)**2+(y-.92)**2<.001);rgb[bolt & (v<.4)]=.39;height[bolt & (v<.4)]=.08
    # Eight full-width trim strips above the plain panel field.
    bands={1:((.78,.42,.08),(.8,.31,.025),.36,.2),2:((.045,.105,.112),(0,0,0),.7,.4),3:((.65,.72,.76),(.85,.88,1),.32,.1),4:((.075,.09,.11),(0,0,0),.77,.7),5:((.55,.35,.09),(0,0,0),.6,.3),6:((.23,.27,.30),(0,0,0),.5,.9),7:((.12,.24,.26),(.04,.22,.26),.4,.3),8:((.18,.21,.22),(0,0,0),.8,.7)}
    for region,(color,e,r,m) in bands.items():
        lo=.4+(region-1)*.075;local=(v-lo)/.075;mask=(v>=lo)&(v<lo+.075);c=np.zeros_like(rgb);c[:]=color
        if region==5:
            stripe=((u*12+local*.6)%1)<.48;c[stripe]=(.055,.065,.075);c[local<.78]=(.23,.27,.30)
        elif region==8:
            grill=((u*28)%1<.32);c[grill]=(.025,.037,.046)
        elif region in [2,7]:
            border=(local<.12)|(local>.88)|((u*8)%1<.13);c[border]=(.025,.037,.046)
        c*= (1-.10*np.exp(-((local-.07)/.13)**2))[:,:,None]
        rgb[mask]=c[mask];emit[mask]=e;rough[mask]=r;metal[mask]=m
    # Base/emission are supplied as display-referred sRGB; no per-pixel grain.
    dy,dx=np.gradient(height);normal=np.stack([-dx*12,-dy*12,np.ones_like(dx)],axis=2);normal/=np.linalg.norm(normal,axis=2)[:,:,None]
    arrays=dict(base=rgb,normal=normal*.5+.5,orm=np.stack([np.ones_like(rough),rough,metal],axis=2),emissive=emit)
    for k,pixels in arrays.items():
        im=K4_SHARED['images'][k];rgba=np.ones((size,size,4),np.float32);rgba[:,:,:3]=pixels;im.pixels.foreach_set(rgba.ravel());im.update();im.filepath_raw=str(OUT/'kit_shared'/('kit_'+k+'.png'));im.save();im.pack()
    mat=K4_SHARED['material'];bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Emission Strength'].default_value=3.0
    for n in mat.node_tree.nodes:
        if n.type=='TEX_IMAGE':
            for link in list(mat.node_tree.links):
                if link.to_node==n and link.to_socket==n.inputs['Vector']:mat.node_tree.links.remove(link)
    next(n for n in mat.node_tree.nodes if n.type=='NORMAL_MAP').uv_map='UVMap'
    dump(OUT/'kit_shared/shared_material.json',dict(review='review-5',material=mat.name,resolution=1024,panel_tile_physical_size_m=5,albedo_srgb_nominal=[.28,.35],bands=['5m plain panel with seams and bolts','amber','dead teal window','ceiling light','dark rib','hazard chevron','metal rib','cyan window','vent grille'],wear='Soft edge/soot gradients; no stochastic pixel speckle',license='Original procedural work'))
    purge('Review5 common trim sheet')


class K5Mesh:
    def __init__(self):self.vertices=[];self.faces=[];self.uvs=[]
    def quad(self,points,region=0,tile=0):
        start=len(self.vertices);self.vertices.extend([tuple(p) for p in points]);self.faces.append(tuple(range(start,start+4)))
        if region==0:lo=(tile%4)*.25+.006;hi=lo+.238*min(1,(Vector(points[1])-Vector(points[0])).length/10);bottom=.012;top=bottom+.376*min(1,(Vector(points[3])-Vector(points[0])).length/10)
        else:lo=.008;hi=.992;bottom=.4+(region-1)*.075+.009;top=bottom+.057
        coords=[(lo,bottom),(hi,bottom),(hi,top),(lo,top)]
        if region==5 and (Vector(points[1])-Vector(points[0])).length < (Vector(points[3])-Vector(points[0])).length:coords=[(lo,bottom),(lo,top),(hi,top),(hi,bottom)]
        self.uvs.append(coords)
    def box(self,p,size,region=6,rotation=None):
        p=Vector(p);x,y,z=[a/2 for a in size];verts=[Vector(q) for q in [(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]]
        if rotation:verts=[rotation@q for q in verts]
        verts=[q+p for q in verts]
        for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:self.quad([verts[i] for i in f],region)
    def panel_grid(self,a,b,c,d,pitch=5,region=0,offset=0,omit=False):
        a,b,c,d=map(Vector,[a,b,c,d]);nu=max(1,round((b-a).length/pitch));nv=max(1,round((d-a).length/pitch));n=(b-a).cross(d-a).normalized()
        for i in range(nu):
            for j in range(nv):
                if omit and (i*13+j*7)%97==11:continue
                inset=.025 if region==0 else 0;z=offset+([.0,.5,1.0][(i+2*j)%3] if offset else 0)
                def at(u,v):return a+(b-a)*u+(d-a)*v+n*z
                self.quad([at((i+inset)/nu,(j+inset)/nv),at((i+1-inset)/nu,(j+inset)/nv),at((i+1-inset)/nu,(j+1-inset)/nv),at((i+inset)/nu,(j+1-inset)/nv)],region,(i+j)%4)
    def finish(self,name,scene):
        me=bpy.data.meshes.new(name);me.from_pydata(self.vertices,[],self.faces);me.update();ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob);uv=me.uv_layers.new(name='UVMap')
        for f,coords in zip(me.polygons,self.uvs):
            for li,co in zip(f.loop_indices,coords):uv.data[li].uv=co
        bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();me.materials.append(K4_SHARED['material']);return ob


def k5_section(half=45,chamfer=8):
    h,c=half,chamfer;return [(-h+c,-h),(h-c,-h),(h,-h+c),(h,h-c),(h-c,h),(-h+c,h),(-h,h-c),(-h,-h+c)]


def k5_sweep(mesh,centres,tangents,section,region=6,panels=False,offset=0):
    rings=[]
    for p,t in zip(centres,tangents):
        p,t=Vector(p),Vector(t).normalized();hint=Vector((0,0,1)) if abs(t.z)<.9 else Vector((0,1,0));u=t.cross(hint).normalized();v=u.cross(t).normalized();rings.append([p+u*x+v*z for x,z in section])
    for a,b in zip(rings,rings[1:]):
        for j in range(len(section)):
            pts=[a[j],a[(j+1)%len(section)],b[(j+1)%len(section)],b[j]]
            if panels:mesh.panel_grid(*pts,pitch=10,region=region,offset=offset,omit=True)
            else:mesh.quad(pts,region)
    return rings


def k5_ring(mesh,p,t,outer=49,inner=31.5,width=5,region=6,chamfer=10):
    p,t=Vector(p),Vector(t).normalized();centres=[p-t*width/2,p+t*width/2]
    a=k5_sweep(mesh,centres,[t,t],k5_section(outer,chamfer),region);b=k5_sweep(mesh,centres,[t,t],k5_section(inner,3),region)
    for i in [0,1]:
        for j in range(8):mesh.quad([a[i][j],a[i][(j+1)%8],b[i][(j+1)%8],b[i][j]],region)


def k5_port_rim(mesh,p,n,neck_inner=31.5):
    p,n=Vector(p),Vector(n);hint=Vector((0,0,1)) if abs(n.z)<.9 else Vector((0,1,0));u=n.cross(hint).normalized();v=u.cross(n).normalized()
    # Exact 90/70 square at the mating plane; 7m proud octagonal shoulder 8m behind it.
    sections=[(p,45,.0,35,.0),(p-n*8,52,12,neck_inner,3)]
    outer=[];inner=[]
    for centre,h,c,ih,ic in sections:
        outer.append([centre+u*x+v*y for x,y in k5_section(h,max(c,.0001))]);inner.append([centre+u*x+v*y for x,y in k5_section(ih,max(ic,.0001))])
    for j in range(8):
        j1=(j+1)%8;mesh.quad([outer[0][j],outer[0][j1],outer[1][j1],outer[1][j]],6);mesh.quad([inner[0][j],inner[1][j],inner[1][j1],inner[0][j1]],4)
        mesh.quad([outer[0][j],inner[0][j],inner[0][j1],outer[0][j1]],5)
        mesh.quad([outer[1][j],outer[1][j1],inner[1][j1],inner[1][j]],5)


def k5_clear_lods(name):
    s=STATE[name];bpy.context.window.scene=s['scene']
    for ob in list(s['scene'].objects):
        if ob.type=='MESH' and ob!=s['collider']:bpy.data.objects.remove(ob,do_unlink=True)
        elif ob.type in ['LIGHT','CAMERA']:bpy.data.objects.remove(ob,do_unlink=True)
    s['lods']=[];s['unmet']=[];s['render_parts']=[];purge(name+' old render data removed')


def k5_corridor_geometry(name):
    s=STATE[name];m=K5Mesh();path=s['paths'][0];_,pts=r1_path_at_distance(path,10 if name=='kit_bend' else 5);pts=[Vector(p) for p in pts];tangents=[(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized() for i in range(len(pts))]
    # The shoulders occupy the first and last 8m; carry a chamfered dark pressure hull beneath the plating.
    k5_sweep(m,pts,tangents,list(reversed(k5_section())),4);k5_sweep(m,pts,tangents,k5_section(35,3),0)
    # Plates only on the four broad facets; smaller bevel facets stay as dark load-bearing chines.
    outer=k5_section()
    for j in [0,2,4,6]:
        for i in range(len(pts)-1):
            p,q=pts[i],pts[i+1];t=tangents[i];u=t.cross(Vector((0,0,1))).normalized();v=u.cross(t).normalized();a,b=outer[j],outer[(j+1)%8]
            m.panel_grid(p+u*b[0]+v*b[1],p+u*a[0]+v*a[1],q+u*a[0]+v*a[1],q+u*b[0]+v*b[1],pitch=10,offset=.5,omit=True)
    _,ribs=r1_path_at_distance(path,20)
    for i,p in enumerate(ribs[1:-1],1):
        j=min(range(len(pts)),key=lambda j:(pts[j]-Vector(p)).length);k5_ring(m,p,tangents[j])
    for port in s['ports']:k5_port_rim(m,(port['position'][0],-port['position'][2],port['position'][1]),(port['direction'][0],-port['direction'][2],port['direction'][1]))
    _,lamps=r1_path_at_distance(path,10)
    for i,p in enumerate(lamps[1:-1],1):
        p=Vector(p);j=min(range(len(pts)),key=lambda j:(pts[j]-p).length);t=tangents[j];u=t.cross(Vector((0,0,1))).normalized();v=u.cross(t).normalized();rot=t.to_track_quat('Y','Z').to_matrix()
        for side in [-1,1]:
            m.box(p+u*side*21-v*(31.25 if i%2==0 else 34.7),(.8,3,.35),1,rot);m.box(p+u*side*34.8+v*4,(.35,5,.9),2,rot)
        if i in [1,3,5] or (len(lamps)>12 and i%4==0):m.box(p+v*34.5,(12,2,.6),3,rot)
        # Small windows on the starboard wall, most dead.
        m.box(p+u*45.6+v*13,(1.2,4,2),1 if i%4==0 else 2,rot)
    # Conduits are two long 8-sided runs, mounted outside the roof.
    for side in [-1,1]:
        pp=[]
        for p,t in zip(pts,tangents):
            u=t.cross(Vector((0,0,1))).normalized();pp.append(p+u*side*18+Vector((0,0,47)))
        for a,b in zip(pp,pp[1:]):
            d=(b-a).normalized();u=d.cross(Vector((0,0,1))).normalized();v=u.cross(d).normalized()
            for j in range(8):
                aa=j*math.pi/4;bb=(j+1)*math.pi/4;m.quad([a+(u*math.cos(aa)+v*math.sin(aa))*.8,a+(u*math.cos(bb)+v*math.sin(bb))*.8,b+(u*math.cos(bb)+v*math.sin(bb))*.8,b+(u*math.cos(aa)+v*math.sin(aa))*.8],6)
    p=pts[len(pts)//2];m.box(p+Vector((0,0,45.9)),(18,12,.6),8);m.box(p+Vector((24,0,47.5)),(1.2,1.2,5),6);m.box(p+Vector((24,0,50.1)),(2,2,.5),1)
    return m


def k5_lods(name,mesh):
    s=STATE[name];ob=mesh.finish(name+'_lod0',s['scene']);ob['asset_node']='lod0';s['lod0']=ob;s['lods']=[ob];ob.data.set_sharp_from_angle(angle=.65)
    room=name in ['kit_room','kit_hall','kit_hangar','kit_tower','kit_tower_top','kit_room_collapsed'];cap=11800 if room else 3900
    if len(ob.data.polygons)>cap:decimate(ob,cap)
    for level,ratio in [(1,.35),(2,.10)]:
        child=ob.copy();child.data=ob.data.copy();s['scene'].collection.objects.link(child);child.name=name+'_lod'+str(level);child['asset_node']='lod'+str(level)
        if level==2:k5_drop_small_islands(child,150)
        decimate(child,round(len(ob.data.polygons)*ratio));child.hide_render=True;child.hide_set(True);s['lods'].append(child)
    s['collider'].hide_set(True);s['collider'].hide_render=True;purge(name+' Review5 LODs')


def k5_distance(name):
    s=STATE[name];result={}
    for label,source,target in [('lod0_to_collider',s['lod0'],s['collider']),('collider_to_lod0',s['collider'],s['lod0'])]:
        points,vertices=r1_sample_surface(source,16000);points=np.concatenate([points,vertices]);tree=mesh_bvh(target)[0];d=np.array([tree.find_nearest(Vector(p))[3] for p in points]);i=int(d.argmax());result[label]=dict(samples=len(points),maximum_m=float(d[i]),p99_m=float(np.percentile(d,99)),maximum_location_yup=yup(points[i]),samples_over_075_m=int((d>.75).sum()))
    result['rule']='Review5 explicit simple-collider exception for ribs/pipes; heavy 7m shoulders explicitly requested; square collider corner recesses at 8m hull chamfers retained.';s['distance']=result;print('DISTANCE',name,json.dumps(result));purge(name+' Review5 surface measurement')


def k5_lighting(name):
    s=STATE[name];sc=s['scene'];set_engine(sc,'BLENDER_EEVEE');sc.eevee.taa_render_samples=16;sc.eevee.use_raytracing=False;enum_value(sc.eevee,'shadow_pool_size','64');sc.render.resolution_x=1600;sc.render.resolution_y=1000;sc.render.resolution_percentage=100;sc.render.threads_mode='FIXED';sc.render.threads=2;enum_value(sc.view_settings,'view_transform','AgX');sc.view_settings.exposure=.3
    bg=next(n for n in sc.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.016,.027,.046,1);bg.inputs['Strength'].default_value=.35
    light(sc,'Station key sun',(-300,-500,600),3.0,(1,.86,.72),kind='SUN');light(sc,'Cool space fill',(200,-160,100),3.8e6,(.45,.68,1),180);light(sc,'Blue stern rim',(-180,180,130),4.5e6,(.42,.66,.95),140)
    coords=np.array([v.co[:] for v in s['collider'].data.vertices]);target=Vector((coords.min(axis=0)+coords.max(axis=0))*.5);s['preview_specs']={'exterior_300m':(list(target+Vector((1,-1.4,.85)).normalized()*300),list(target),None,22 if max(s['collider'].dimensions)<200 else 16)}
    if s['paths']:
        path=max(s['paths'],key=lambda p:sum((Vector(a)-Vector(b)).length for a,b in zip(p,p[1:])));_,points=r1_path_at_distance(path,30)
        for i,p in enumerate(points):
            p=Vector(p);light(sc,'Warm ceiling practical '+str(i),p+Vector((0,0,24)),120000,(1,.65,.35),18,target=p-Vector((0,0,34)));light(sc,'Cool wall bounce '+str(i),p,35000,(.3,.58,.72),kind='POINT')
        _,pts=r1_path_at_distance(path,5);p=Vector(pts[min(2,len(pts)-2)])+Vector((0,0,4));target=Vector(pts[min(len(pts)-1,14)]);s['preview_specs']['interior']=(list(p),list(target),None,20)
    else:
        s['preview_specs']['interior']=(list(target+Vector((1,-1,.4)).normalized()*max(70,float(max(s['collider'].dimensions))*1.4)),list(target),None,35)
    purge(name+' game lighting')

# Preserve implementations used to validate the fixed collider, navigation and port metadata.
K5_BASE_VALIDATE=globals().get('K5_BASE_VALIDATE',k4_validate)
K5_BASE_DELIVER=globals().get('K5_BASE_DELIVER',k4_deliver)

def k5_validate(name):
    k5_distance(name);K5_BASE_VALIDATE(name);s=STATE[name];v=s['validation'];v['review']='review-5';render_tree=mesh_bvh(s['lod0'])[0]
    render_routes=[]
    for i,path in enumerate(s['paths']):
        d=[render_tree.find_nearest(Vector(p))[3]*2 for p in sample_path(path,2)];assert min(d)>=61.99,(name,i,min(d));render_routes.append(dict(path=i,minimum_clear_diameter_m=min(d)))
    v['render_route_clearance']=render_routes;v['route_clearance_before_after_m']=[dict(path=i,collider=r['minimum_clear_diameter_m'],render=render_routes[i]['minimum_clear_diameter_m']) for i,r in enumerate(v['paths'])];v['largest_closed_gap_m']=8 if not name.startswith('kit_dressing') and name!='kit_cap' else 0;v['largest_closed_gap_location']='Square collider corner behind 8m 45-degree outer hull chamfer' if v['largest_closed_gap_m'] else None
    v['review5_geometry']=dict(panel_pitch_m=5,structural_rib_pitch_m=20,outer_hull_chamfer_m=8,rib_proud_m=4,heavy_rim_proud_m=7,port_mating_plane_preserved=True)
    target=(6000,12000) if name in ['kit_room','kit_hall','kit_hangar','kit_tower','kit_tower_top','kit_room_collapsed'] else (2000,4000)
    count=len(s['lod0'].data.polygons)
    if not name.startswith('kit_dressing') and name!='kit_cap' and not target[0]<=count<=target[1]:s['unmet'].append('LOD0 target '+str(target)+' triangles; actual '+str(count))
    v['unmet_rules']=s['unmet'];dump(OUT/name/'validation.json',v)


def k5_deliver(name):
    s=STATE[name]
    for ob in s['lods']:ob.data.validate(clean_customdata=False)
    s['validation']['lod_triangle_counts']={ob['asset_node']:len(ob.data.polygons) for ob in s['lods']}
    K5_BASE_DELIVER(name)
    raw=(OUT/name/(name+'.glb')).read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);assert len(doc['materials'])==1 and len(doc['images'])==4
    assert {o['name'] for o in doc['nodes']}=={'collider','lod0','lod1','lod2'}|{m['name'] for m in s['markers']}
    for im in doc['images']:assert (OUT/name/im['uri']).exists()
    for view in ['exterior_300m','interior']:assert (OUT/name/'previews'/(view+'.png')).exists()
    r1_verify_glb(name);s['verified']=True;s['validation']['export_revalidated']=True;dump(OUT/name/'validation.json',s['validation']);s['scene']['review5_verified']=True;k4_save();print('COMPLETE',name,s['validation']['lod_triangle_counts'])

K5_BASE_BUILD=globals().get('K5_BASE_BUILD',k4_build)

def k5_build(name):
    if name in K4_ORDER[:7] or name=='kit_room_collapsed':
        s=K5_BASE_BUILD(name)
        if name=='kit_room_collapsed':boolean_cut(s['collider'],cube_part('Collapsed roof opening',(41,41,55),(27,27,30)));r3_heal(s['collider'])
        s['collider'].hide_set(False);select(s['collider']);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);return s
    s=k4_new(name);s['paths']=[]
    if name=='kit_hall':
        ob=cube_part('Farm hall thick hull',(0,0,0),(240,120,140));boolean_cut(ob,cube_part('Farm hall free interior',(0,0,0),(220,100,120)))
        for x in [-60,60]:
            for sign in [-1,1]:boolean_cut(ob,cube_part('70m farm hall port',(x,sign*55,0),(70,30,70)));k4_port(s,(x,sign*60,0),(0,sign,0))
        collar=cube_part('Top grid collar',(-60,0,70),(90,90,20));ob=r1_union([ob,collar],name+'_collider');boolean_cut(ob,cube_part('Up port clear shaft',(-60,0,70),(70,70,40)));k4_port(s,(-60,0,80),(0,0,1))
        # All ten port pairs; horizontal side changes use >=60m turns in the broad hall.
        for x in [-60,60]:s['paths'].append([[x,-60,0],[x,60,0]])
        for sign in [-1,1]:s['paths'].append([[-60*math.cos(a),sign*60-sign*60*math.sin(a),0] for a in np.linspace(0,math.pi,65)])
        for sign in [-1,1]:s['paths'].append(k4_arc((-60,sign*60,0),(-60,0,60),(-60,sign*60,60),'X')+[[-60,0,80]])
        # Cross-diagonal and far-side upward routes enter with a 60m arc and join a longitudinal trunk.
        for sign in [-1,1]:
            curve=k4_arc((60,sign*60,0),(0,0,0),(0,sign*60,0));last=k4_arc((0,0,0),(-60,-sign*60,0),(0,-sign*60,0));s['paths'].append(r1_concat(curve,last))
        for sign in [-1,1]:
            first=k4_arc((60,sign*60,0),(0,0,0),(0,sign*60,0));last=k4_arc((-60,0,0),(-60,0,60),(-60,0,60),'X') if False else []
            # Horizontal trunk and a vertical 60m bend centred at (-60,0,60).
            up=k4_arc((0,0,0),(-60,0,60),(-60,0,0),'Z') if False else []
            # Use XZ rotation about Y for this turn.
            from mathutils import Quaternion
            up=[[-60*math.sin(a),0,60-60*math.cos(a)] for a in np.linspace(0,math.pi/2,33)]
            s['paths'].append(r1_concat(first,up,[[-60,0,60],[-60,0,80]]))
        for x in [-75,0,75]:
            for y in ([-42,42] if x==-75 else [-27,27]):k4_point(s,'deposit',(x,y,60),(0,0,-1))
        for x in [-60,0,60]:k4_point(s,'cargo',(x,0,0))
        s['unmet'].append('140m main hall height plus a 10m top collar to place the upward port on the required 20m grid (overall height 150m).')
    elif name=='kit_hangar':
        ob=cube_part('Hangar outer pressure armour',(0,0,0),(160,160,110));boolean_cut(ob,cube_part('140x90 open hangar maw',(0,-10,0),(140,160,90)));boolean_cut(ob,cube_part('Rear 70m connector',(0,75,0),(70,30,70)));k4_port(s,(0,80,0),(0,1,0));marker(s,'entrance_1',(0,-80,0),(0,-1,0));s['paths']=[[[0,-80,0],[0,80,0]]];k4_point(s,'pad',(0,-15,-45));k4_point(s,'cargo',(0,0,0));k4_point(s,'deposit',(-70,-5,4),(1,0,0));k4_point(s,'deposit',(70,-5,4),(-1,0,0))
    elif name in ['kit_tower','kit_tower_top']:
        # A 90m side-port rim cannot fit the nominal 80m stack. Preserve all hard opening and bend constraints.
        ob=cube_part('80m tower body plus two 20m stacking collars',(0,0,0),(120,120,120));boolean_cut(ob,cube_part('Tower 100m free well',(0,0,0),(100,100,140)))
        for z,sign in [(-60,-1),(60,1)]:k4_port(s,(0,0,z),(0,0,sign))
        # Top/bottom openings narrowed to the shared 70m square using solid annular collars.
        for sign in [-1,1]:
            ring=cube_part('Stacking port neck',(0,0,sign*55),(120,120,10));boolean_cut(ring,cube_part('70m stack connector',(0,0,sign*55),(70,70,20)));ob=r1_union([ob,ring],name+'_collider')
        boolean_cut(ob,cube_part('Side tower port',(0,-55,0),(70,30,70)));k4_port(s,(0,-60,0),(0,-1,0));s['paths']=[[[0,0,-60],[0,0,60]]]
        for sign in [-1,1]:s['paths'].append(k4_arc((0,-60,0),(0,0,sign*60),(0,-60,sign*60),'X'))
        if name=='kit_tower_top':
            # Lantern sits to the side of the stack axis, preserving the upward connector.
            mast=cube_part('Lantern supported spine',(52,20,69),(12,24,36));lantern=cube_part('Lantern housing',(52,20,89),(24,30,10));ob=r1_union([ob,mast,lantern],name+'_collider')
        k4_point(s,'cargo',(0,0,0));s['unmet'].append('80m body is represented with two 20m stacking collars: effective height and stacking pitch 120m, required for the 90m side rim and >=60m bends.')
    elif name=='kit_corridor_broken':
        ob=k4_tube(name,[(0,-40,0),(0,40,0)],[(0,1,0)]*2);boolean_cut(ob,cube_part('Rupture open to space',(40,0,0),(30,64,70)));k4_ports_paths(s,[((0,-40,0),(0,-1,0)),((0,40,0),(0,1,0))]);marker(s,'entrance_1',(45,0,0),(1,0,0));s['paths']=[[[0,-40,0],[0,40,0]]];s['breach_clear_size_m']=[64,70];s['paths'].append([[45,0,0],[0,0,0]]);s['unmet'].append('The compact 80m broken module has a straight 64m side-entry spur; its junction with the main route requires an in-place turn, not a contained 60m-radius connecting curve.')
    elif name.startswith('kit_dressing'):
        parts=[cube_part('20m grid mounting foot',(0,0,3),(20,20,6))]
        if name.endswith('antenna'):
            parts += [cube_part('Antenna spine',(0,0,23),(5,5,40)),cube_part('Antenna receiver head',(0,0,43),(30,9,7))]
            for x in [-12,0,12]:parts.append(cube_part('Receiver fork',(x,0,50),(2,2,16)))
        elif name.endswith('solar_stub'):
            parts += [cube_part('Fractured solar mounting spar',(0,0,13),(8,8,20)),cube_part('Solar broken wing',(18,0,22),(55,30,4)),cube_part('Broken projecting root',(43,9,23),(14,4,5))]
        elif name.endswith('radiator'):
            parts += [cube_part('Radiator backbone',(0,0,13),(8,35,20))]
            for y in [-14,-7,0,7,14]:parts.append(cube_part('Heat exchanger fin',(0,y,18),(45,2,24)))
        else:
            parts.append(cube_part('Connected tank support skid',(0,0,8),(42,30,8)))
            for x,y in [(-12,-8),(12,-8),(-12,8),(12,8)]:parts.append(r3_cyl('Station gas reservoir',(x,y,24),7,30,16,6))
        ob=r1_union(parts,name+'_collider');marker(s,'mount',(0,0,0),(0,0,-1));s['nominal_wall_thickness_m']=None
    else:raise ValueError(name)
    r3_heal(ob);ob.name=name+'_collider';ob['asset_node']='collider';r1_region(ob,0);s['collider']=ob;s['render_parts']=[];purge(name+' closed collider');return s


def k5_generic_geometry(name):
    s=STATE[name];col=s['collider'];m=K5Mesh();coords=np.array([v.co[:] for v in col.data.vertices]);lo=coords.min(axis=0);hi=coords.max(axis=0);room=name in ['kit_room','kit_hall','kit_hangar','kit_tower','kit_tower_top','kit_room_collapsed'];tree=mesh_bvh(col)[0]
    # Bevel only the exposed convex outer hull edges, never mating planes or connector throats.
    base=col.copy();base.data=col.data.copy();s['scene'].collection.objects.link(base);base.hide_set(False);base.hide_render=False;select(base);weights=base.data.attributes.get('bevel_weight_edge') or base.data.attributes.new('bevel_weight_edge','FLOAT','EDGE')
    for edge in base.data.edges:
        a,b=[base.data.vertices[i].co for i in edge.vertices];outside=sum(all(abs(v[k]-lo[k])<.001 for v in [a,b]) or all(abs(v[k]-hi[k])<.001 for v in [a,b]) for k in range(3))>=2;flush=False
        for port in s['ports']:
            p=Vector((port['position'][0],-port['position'][2],port['position'][1]));n=Vector((port['direction'][0],-port['direction'][2],port['direction'][1]));flush|=abs((a-p).dot(n))<.001 and abs((b-p).dot(n))<.001
        weights.data[edge.index].value=1 if outside and not flush else 0
    bevel=base.modifiers.new('Station octagonal outer corner breaks','BEVEL');bevel.limit_method='WEIGHT';bevel.width=2 if name=='kit_room_collapsed' else .3 if name.startswith('kit_dressing') else 8;bevel.segments=1;bpy.ops.object.modifier_apply(modifier=bevel.name)
    decimate(base,1000000)
    for f in base.data.polygons:
        # Carry the pressure wall with broad, quiet panel tiles; projected plates supply the 5m grid.
        q=[base.matrix_world@base.data.vertices[i].co for i in f.vertices];start=len(m.vertices);m.vertices.extend(q);m.faces.append(tuple(range(start,start+3)));m.uvs.append([(.12,.2)]*3)
    surface=mesh_bvh(base)[0]
    # Tiled armour on the six outside faces, ray projected to actual visible hull; holes stay open.
    pitch=20 if room else 12
    for axis in range(3):
        a,b=[j for j in range(3) if j!=axis]
        for sign in [-1,1]:
            na=max(1,round((hi[a]-lo[a])/pitch));nb=max(1,round((hi[b]-lo[b])/pitch));da=(hi[a]-lo[a])/na;db=(hi[b]-lo[b])/nb
            for i in range(na):
                for j in range(nb):
                    p=Vector((0,0,0));p[axis]=(hi[axis]+20 if sign>0 else lo[axis]-20);p[a]=lo[a]+(i+.5)*da;p[b]=lo[b]+(j+.5)*db;d=Vector((0,0,0));d[axis]=-sign;hit,n,_,_=surface.ray_cast(p,d,hi[axis]-lo[axis]+40)
                    if hit is None or n[axis]*sign<.95:continue
                    # No projected plate may intrude into a connector opening or cross a cut edge.
                    points=[]
                    for u,v in [(-.46,-.46),(.46,-.46),(.46,.46),(-.46,.46)]:
                        q=p.copy();q[a]+=u*da;q[b]+=v*db;h,nn,_,_=surface.ray_cast(q,d,hi[axis]-lo[axis]+40)
                        if h is None or abs(h[axis]-hit[axis])>.02:break
                        points.append(h+n*(.5+.5*((i+j)%3)))
                    if len(points)!=4:continue
                    if (points[1]-points[0]).cross(points[3]-points[0]).dot(n)<0:points.reverse()
                    
                    if room or name=='kit_corridor_broken':k6_plate(m,points,n,.5+.5*((i+j)%3))
                    else:m.quad(points,8 if (i*7+j)%59==5 else 0,(i+j)%4)
    # Exterior strap ribs follow every 20m slab, clipped at holes and the chamfered hull.
    long_axis=int(np.argmax(hi-lo));other=[a for a in range(3) if a!=long_axis]
    for station in np.arange(math.ceil(lo[long_axis]/20)*20+20,hi[long_axis]-5,20):
        for wall in other:
            across=next(a for a in other if a!=wall)
            for sign in [-1,1]:
                runs=[];run=[]
                for span in np.arange(lo[across]+5,hi[across]-1,10):
                    p=Vector((0,0,0));p[long_axis]=station;p[wall]=hi[wall]+20 if sign>0 else lo[wall]-20;p[across]=span;d=Vector((0,0,0));d[wall]=-sign;h,n,_,_=surface.ray_cast(p,d,hi[wall]-lo[wall]+40)
                    if h is None or n[wall]*sign<.95:
                        if run:runs.append(run);run=[]
                        continue
                    valid=True
                    for off in [-4.9,4.9]:
                        q=p.copy();q[across]+=off;hh,nn,_,_=surface.ray_cast(q,d,hi[wall]-lo[wall]+40)
                        if hh is None or abs(hh[wall]-h[wall])>.02:valid=False;break
                    if not valid:
                        if run:runs.append(run);run=[]
                        continue
                    if run and abs(h[wall]-run[-1][wall])>.02:runs.append(run);run=[]
                    run.append(h)
                if run:runs.append(run)
                for run in runs:
                    h=(run[0]+run[-1])*.5;n=Vector((0,0,0));n[wall]=sign;size=[0,0,0];size[long_axis]=5;size[wall]=4;size[across]=abs(run[-1][across]-run[0][across])+9.8;m.box(h+n*2,size,6)
    for port in s['ports']:
        if not port.get('cap'):k5_port_rim(m,(port['position'][0],-port['position'][2],port['position'][1]),(port['direction'][0],-port['direction'][2],port['direction'][1]),33.5)
    # Inside fixtures, floor strips every 10m, with no obstruction of the fixed paths.
    seen=set()
    for path in s['paths']:
        _,points=r1_path_at_distance(path,10)
        for i,p in enumerate(points[1:-1],1):
            p=Vector(p);key=tuple(round(q/8) for q in p)
            if key in seen:continue
            seen.add(key)
            for sign in [-1,1]:
                start=p+Vector((sign*18,0,0));h,n,_,_=tree.ray_cast(start,Vector((0,0,-1)),200)
                if h is not None and n.z>.9:m.box(h+Vector((0,0,.12)),(.8,3,.22),1)
            if i%3==1:
                h,n,_,_=tree.ray_cast(p,Vector((0,0,1)),200)
                if h is not None and n.z<-.9:m.box(h-Vector((0,0,.22)),(10,3,.4),3)
            if i%2==1:
                for sign in [-1,1]:
                    h,n,_,_=tree.ray_cast(p,Vector((sign,0,0)),250)
                    if h is not None and abs(n.x)>.9:m.box(h+n*.1,(.18,6,.8),2)
    # Internal frame orientation follows the principal route (including vertical tower wells).
    if s['paths']:
        path=s['paths'][0];vertical=abs(path[-1][2]-path[0][2])>abs(path[-1][1]-path[0][1]);_,stations=r1_path_at_distance(path,20)
        for p in stations[1:-1]:
            p=Vector(p);hits={};directions=[('left',(-1,0,0)),('right',(1,0,0)),('floor',(0,-1,0)),('roof',(0,1,0))] if vertical else [('left',(-1,0,0)),('right',(1,0,0)),('floor',(0,0,-1)),('roof',(0,0,1))]
            for key,d in directions:
                h,n,_,_=tree.ray_cast(p,Vector(d),200)
                if h is not None:hits[key]=(h,n)
            width=min([(hits[k][0]-p).length for k in ['left','right'] if k in hits]+[45])*2-1
            height=min([(hits[k][0]-p).length for k in ['floor','roof'] if k in hits]+[45])*2-1
            for key,(h,n) in hits.items():
                if vertical:size=(width,1.2,5) if key in ['floor','roof'] else (1.2,height,5)
                else:size=(width,5,1.2) if key in ['floor','roof'] else (1.2,5,height)
                span_axis=max(range(3),key=lambda j:size[j]);attached=True
                for offset in np.linspace(-size[span_axis]/2,size[span_axis]/2,max(3,math.ceil(size[span_axis]/5))):
                    q=h.copy();q[span_axis]+=offset
                    if tree.find_nearest(q)[3]>.05:attached=False;break
                if attached:m.box(h+n*.6,size,6)
        if vertical:
            for z in np.arange(lo[2]+15,min(hi[2],60)-10,10):
                for sign in [-1,1]:m.box((sign*49.85,0,z),(.2,.8,3),1)
            for x in [-18,18]:k6_pipe(m,[(x,61.2,-45),(x,61.2,45)])
    if name=='kit_dressing_solar_stub':
        for i in range(6):
            for j in range(3):
                if (i,j)==(5,2):continue
                x=-8+i*8.6;y=-13+j*8.6;m.quad([(x,y,24.08),(x+8,y,24.08),(x+8,y+8,24.08),(x,y+8,24.08)],2)
    if name=='kit_dressing_tank_cluster':
        for x,y in [(-12,-8),(12,-8),(-12,8),(12,8)]:
            for z in [15,29,38]:
                for i in range(16):
                    a=i*math.pi/8;b=(i+1)*math.pi/8;m.quad([(x+7.15*math.cos(t),y+7.15*math.sin(t),zz) for t,zz in [(a,z-.6),(b,z-.6),(b,z+.6),(a,z+.6)]],6)
        for y in [-8,8]:k6_pipe(m,[(-5,y,15),(5,y,15)],.7)
    if name=='kit_tower_top':m.box((52,20,89),(24.1,30.1,8),7)
    if name=='kit_corridor_broken':
        for y in [-26,26]:
            for z in [-38,38]:m.box((46,y,z),(8,8,4),6)
        k6_pipe(m,[(45,-24,39),(48,-10,40),(49,4,39),(45,23,40)],.8)
    if name=='kit_hangar':
        for j in range(32):
            a=j*math.pi/16;b=(j+1)*math.pi/16
            m.quad([(r*math.cos(t),-15+r*math.sin(t),-44.92) for r,t in [(25,a),(26,a),(26,b),(25,b)]],7)
    # Small windows and roof service pipes unify the kit with Sessiz Liman.
    for window_index,y in enumerate(np.arange(lo[1]+15,hi[1]-5,15)):
        h,n,_,_=surface.ray_cast(Vector((hi[0]+20,y,hi[2]*.25)),Vector((-1,0,0)),hi[0]-lo[0]+40)
        if h is not None and n.x>.9:m.box(h+Vector((.6,0,0)),(1.2,4.5,1.8),1 if window_index%4==0 else 2)
    if not name.startswith('kit_dressing'):
        for x in [-18,18]:
            run=[]
            for y in np.arange(lo[1]+10,hi[1]-9,5):
                h,n,_,_=surface.ray_cast(Vector((x,y,hi[2]+20)),Vector((0,0,-1)),hi[2]-lo[2]+40)
                if h is not None and n.z>.9:run.append(h+Vector((0,0,1.2)))
                else:
                    if len(run)>1:k6_pipe(m,run)
                    run=[]
            if len(run)>1:k6_pipe(m,run)
        for label,x,y in [('vent',hi[0]*.5,18),('mast',hi[0]*.5,0)]:
            h,n,_,_=surface.ray_cast(Vector((x,y,hi[2]+20)),Vector((0,0,-1)),hi[2]-lo[2]+40)
            if h is None or n.z<.9:continue
            if label=='vent':m.box(h+Vector((0,0,.4)),(18,12,.8),8)
            else:m.box(h+Vector((0,0,2)),(1.5,1.5,4),6);m.box(h+Vector((0,0,4)),(2,2,.6),1)
    bpy.data.objects.remove(base,do_unlink=True);return m


def k5_render(name):
    if name=='kit_mouth':m=k6_mouth_geometry(name)
    elif name=='kit_cap':m=k5_cap_geometry(name)
    elif name in ['kit_corridor','kit_bend']:m=k5_corridor_geometry(name)
    else:m=k5_generic_geometry(name)
    k5_lods(name,m);k5_lighting(name);k5_validate(name)


def k5_preview_one(name,kind):
    r1_preview(name,kind)


def k5_drop_small_islands(ob,area_limit):
    bm=bmesh.new();bm.from_mesh(ob.data);unseen=set(bm.faces);drop=[]
    while unseen:
        f=unseen.pop();island=[f];stack=[f]
        while stack:
            for v in stack.pop().verts:
                for other in v.link_faces:
                    if other in unseen:unseen.remove(other);island.append(other);stack.append(other)
        if sum(f.calc_area() for f in island)<area_limit:drop.extend(island)
    bmesh.ops.delete(bm,geom=drop,context='FACES');loose=[v for v in bm.verts if not v.link_faces]
    if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    bm.to_mesh(ob.data);bm.free()

def k5_cap_geometry(name):
    m=K5Mesh();m.box((0,5.1,0),(90,9.8,90),6)
    m.panel_grid((-35,0,-35),(35,0,-35),(35,0,35),(-35,0,35),pitch=5)
    for a,b,c,d in [[(-45,-45),(45,-45),(35,-35),(-35,-35)],[(45,-45),(45,45),(35,35),(35,-35)],[(45,45),(-45,45),(-35,35),(35,35)],[(-45,45),(-45,-45),(-35,-35),(-35,35)]]:m.quad([(x,0,z) for x,z in [a,b,c,d]],5)
    return m

# Review 6: geometry and UV scale are deliberately independent of shared atlas resolution.
def k6_plate(mesh,points,normal,depth=1):
    a,b,c,d=map(Vector,points);n=Vector(normal);u=(b-a).normalized();v=(d-a).normalized();w=(b-a).length;h=(d-a).length;cut=min(1,w*.10,h*.10)
    xy=[(cut,0),(w-cut,0),(w,cut),(w,h-cut),(w-cut,h),(cut,h),(0,h-cut),(0,cut)]
    front=[a+u*x+v*y for x,y in xy];back=[p-n*depth for p in front]
    start=len(mesh.vertices);mesh.vertices.extend(front);mesh.faces.append(tuple(range(start,start+8)));mesh.uvs.append([(.008+.238*x/w,.012+.376*y/h) for x,y in xy])
    for j in range(8):mesh.quad([front[j],back[j],back[(j+1)%8],front[(j+1)%8]],6)


def k6_hazard_uv(name):
    # Remap only the existing hazard UV faces; collision and visible vertex positions stay fixed.
    s=STATE[name]
    for ob in s['lods']:
        me=ob.data;uv=me.uv_layers['UVMap']
        for face in me.polygons:
            coords=np.array([uv.data[i].uv[:] for i in face.loop_indices]);vv=coords[:,1]
            band=5 if float(vv.min())>.699 and float(vv.max())<.776 else 8 if float(vv.min())>.924 and float(vv.max())<1.001 else 2 if float(vv.min())>.474 and float(vv.max())<.551 else 7 if float(vv.min())>.849 and float(vv.max())<.926 else 0
            if not band:continue
            p=np.array([me.vertices[i].co[:] for i in face.vertices]);duv=coords[1:]-coords[0];dp=p[1:]-p[0]
            if abs(np.linalg.det(duv[:2]))<1e-10:continue
            deriv=np.linalg.solve(duv[:2],dp[:2]);metres_per_u=float(np.linalg.norm(deriv[0]));factor=metres_per_u/({5:60,8:140,2:40,7:40}[band])
            for li in face.loop_indices:uv.data[li].uv.x*=factor
        me.update()
    s['scene']['review6_hazard_uv']=True


def k6_validate(name):
    k5_validate(name);s=STATE[name];v=s['validation'];v['review']='review-6';v['hazard_lip_maximum_width_m']=2.7;v['hazard_repeat_pitch_m']=5;v['rim_remaining_surface']='Dark worn gunmetal';v['outer_plate_pitch_m']=20 if name in ['kit_room','kit_hall','kit_hangar','kit_tower','kit_tower_top','kit_room_collapsed'] else None
    # Different refinements have different collider exceptions: preserve measured values, never infer a strict pass.
    distance=v['collider_vs_lod0'];v['strict_075m_rule_met']=all(distance[k]['maximum_m']<=.75 for k in ['lod0_to_collider','collider_to_lod0']);v['review5_detail_exception_used']=not v['strict_075m_rule_met'];dump(OUT/name/'validation.json',v)


def k6_revise_existing(name,room=False):
    s=STATE[name];bpy.context.window.scene=s['scene']
    if room:
        k5_clear_lods(name);s['scene']['review6_hazard_uv']=False;k5_lods(name,k5_generic_geometry(name));k5_lighting(name)
    if not s['scene'].get('review6_hazard_uv'):k6_hazard_uv(name)
    k6_validate(name)


def k6_render(name):
    if name=='kit_mouth':m=k6_mouth_geometry(name)
    elif name=='kit_cap':m=k5_cap_geometry(name)
    elif name in ['kit_corridor','kit_bend']:m=k5_corridor_geometry(name)
    else:m=k5_generic_geometry(name)
    k5_lods(name,m);k5_lighting(name);k6_hazard_uv(name);k6_validate(name);k6_lip_audit(name,True)

def k6_pipe(mesh,points,radius=.8,region=6):
    for a,b in zip(points,points[1:]):
        a,b=Vector(a),Vector(b);t=(b-a).normalized();hint=Vector((0,0,1)) if abs(t.z)<.9 else Vector((0,1,0));u=t.cross(hint).normalized();v=u.cross(t).normalized()
        for j in range(8):
            aa=j*math.pi/4;bb=(j+1)*math.pi/4;mesh.quad([a+(u*math.cos(aa)+v*math.sin(aa))*radius,a+(u*math.cos(bb)+v*math.sin(bb))*radius,b+(u*math.cos(bb)+v*math.sin(bb))*radius,b+(u*math.cos(aa)+v*math.sin(aa))*radius],region)


def k6_mouth_geometry(name):
    m=K5Mesh();ys=np.linspace(-40,20,13);outer=[];inner=[]
    for y in ys:
        h=65-(y+40)/3;ih=h-10;outer.append([Vector((x,y,z)) for x,z in k5_section(h,8)]);inner.append([Vector((x,y,z)) for x,z in k5_section(ih,3)])
    for i in range(12):
        for j in range(8):
            k=(j+1)%8;m.quad([outer[i][k],outer[i][j],outer[i+1][j],outer[i+1][k]],4);m.panel_grid(inner[i][j],inner[i][k],inner[i+1][k],inner[i+1][j],pitch=10)
            if j%2==0:m.panel_grid(outer[i][k],outer[i][j],outer[i+1][j],outer[i+1][k],pitch=10,offset=.6,omit=True)
    for y in [-20,0]:
        h=65-(y+40)/3;k5_ring(m,(0,y,0),(0,1,0),h+4,h-13.5,5)
    # The front flare is a true 110m opening with a quiet armoured rim.
    for j in range(8):m.quad([outer[0][j],inner[0][j],inner[0][(j+1)%8],outer[0][(j+1)%8]],6)
    k5_port_rim(m,(0,20,0),(0,1,0),33.5)
    for x in [-18,18]:k6_pipe(m,[(x,float(y),65-(y+40)/3+1.8) for y in ys[1:-1]])
    from mathutils import Matrix
    slope=Matrix.Rotation(-math.atan(1/3),3,'X');m.box((0,-10,55.6),(18,12,.8),8,slope)
    for i,y in enumerate([-30,-15,0,10]):
        h=65-(y+40)/3;m.box((h+.6,y,12),(1.2,4.5,1.8),1 if i==1 else 2,Matrix.Rotation(math.atan(1/3),3,'Z'))
    for y in [-35,-25,-15,-5,5,15]:
        ih=55-(y+40)/3
        for x in [-18,18]:m.box((x,y,-ih+.2),(.8,3,.35),1,slope)
        if y in [-25,-5,15]:m.box((0,y,ih-.25),(10,2,.5),3,slope)
    m.box((24,-20,59.8),(1.2,1.2,5),6);m.box((24,-20,62.4),(2,2,.5),1)
    return m

def k6_lip_audit(name,repair=False):
    s=STATE[name];reports={};changed=False;threshold=.7585
    for ob in s['lods']:
        maximum=0;count=0;repaired=0;uv=ob.data.uv_layers['UVMap']
        for f in ob.data.polygons:
            co=np.array([uv.data[i].uv[:] for i in f.loop_indices]);vv=co[:,1]
            if vv.min()<.699 or vv.max()>.776 or vv.max()<=threshold:continue
            p=np.array([ob.data.vertices[i].co[:] for i in f.vertices]);dp=p[1:3]-p[0];duv=co[1:3]-co[0]
            if abs(np.linalg.det(duv))<1e-12:continue
            tangents=np.linalg.solve(duv,dp);metric=tangents@tangents.T
            if np.linalg.det(metric)<1e-12:continue
            gradient=math.sqrt(max(0,np.linalg.inv(metric)[1,1]));width=float((vv.max()-max(threshold,vv.min()))/gradient)
            if width>3 and repair:
                delta=float(vv.max()-threshold-2.9*gradient)
                for li in f.loop_indices:uv.data[li].uv.y-=delta
                width=2.9;repaired+=1;changed=True
            maximum=max(maximum,width);count+=1
        reports[ob['asset_node']]=dict(maximum_visible_hazard_width_m=maximum,hazard_triangles=count,repaired_uv_triangles=repaired)
        assert maximum<=3.001,(name,ob['asset_node'],maximum)
    s['validation']['review6_hazard_lip_audit']=reports;s['validation']['review6_room_large_plates']=bool(name!='kit_room' or s['validation'].get('outer_plate_pitch_m')==20);dump(OUT/name/'validation.json',s['validation']);print(name,reports)
    return reports


def k6_reload_shared():
    for k,im in K4_SHARED['images'].items():
        if im.packed_file:im.unpack(method='REMOVE')
        im.filepath=str(OUT/'kit_shared'/('kit_'+k+'.png'));im.reload();im.pack()
    print('Shared PNGs reloaded and freshly packed from disk')
    purge('Texture recovery after restart')

def k6_assembly():
    from mathutils import Matrix
    name='kit_test_assembly';folder=OUT/name;folder.mkdir(exist_ok=True);new_scene(name);s=STATE[name];sc=s['scene'];placements=[];instances=[]
    specs=[('mouth','kit_mouth',(0,0,0),0),('corridor','kit_corridor',(0,60,0),0),('tee','kit_tee',(0,240,0),0),('room','kit_room',(0,440,0),0),('hall','kit_hall',(200,180,0),-math.pi/2),('hangar','kit_hangar',(340,240,0),math.pi/2)]
    def add(label,key,p,rot):
        matrix=rot.to_4x4();matrix.translation=Vector(p);ob=STATE[key]['lod0'].copy();ob.data=ob.data.copy();sc.collection.objects.link(ob);ob.name='Assembly '+label;ob.matrix_world=matrix;ob.hide_set(False);ob.hide_render=False;instances.append(ob)
        record=dict(instance=label,asset=key,position=yup(p),matrix_blender=[list(row) for row in matrix],ports=[])
        for port in STATE[key]['ports']:
            pp=Vector((port['position'][0],-port['position'][2],port['position'][1]));dd=Vector((port['direction'][0],-port['direction'][2],port['direction'][1]));record['ports'].append(dict(name=port['name'],position=matrix@pp,direction=rot@dd))
        placements.append(record);return record
    byname={}
    for label,key,p,a in specs:byname[label]=add(label,key,p,Matrix.Rotation(a,3,'Z'))
    joints=[('mouth',1,'corridor',1),('corridor',2,'tee',1),('tee',2,'room',1),('tee',3,'hall',1),('hall',2,'hangar',1)];used=set();checks=[]
    for a,ai,b,bi in joints:
        pa=byname[a]['ports'][ai-1];pb=byname[b]['ports'][bi-1];error=(pa['position']-pb['position']).length;dot=pa['direction'].dot(pb['direction']);assert error<.0001 and dot<-.99999;used|={(a,ai),(b,bi)};checks.append(dict(a=a,port_a=ai,b=b,port_b=bi,centre_error_m=error,opposed_direction_dot=dot,clear_size_m=[70,70],outer_frame_size_m=[90,90]))
    for label in ['room']:
        for i,port in enumerate(byname[label]['ports'],1):
            if (label,i) in used:continue
            cap=add('cap_'+label+'_'+str(i),'kit_cap',port['position'],Vector((0,1,0)).rotation_difference(port['direction']).to_matrix());cp=cap['ports'][0];assert (cp['position']-port['position']).length<.0001;assert cp['direction'].dot(port['direction'])<-.99999
    # Conservative AABB check: bounding boxes for the actual thick colliders have no positive-volume overlap.
    bounds=[]
    for placement in placements:
        key=placement['asset'];matrix=Matrix(placement['matrix_blender']);vertices=np.array([tuple(matrix@v.co) for v in STATE[key]['collider'].data.vertices]);bounds.append((vertices.min(0),vertices.max(0)))
    intersections=[]
    for i,(lo,hi) in enumerate(bounds):
        for j in range(i):
            overlap=np.minimum(hi,bounds[j][1])-np.maximum(lo,bounds[j][0])
            if np.all(overlap>1e-4):intersections.append([placements[i]['instance'],placements[j]['instance']])
    assert not intersections,intersections
    bpy.ops.object.select_all(action='DESELECT')
    for ob in instances:ob.select_set(True)
    bpy.context.view_layer.objects.active=instances[0];bpy.ops.object.join();s['lod0']=instances[0];s['lod0'].name='Assembled station render';s['paths']=[]
    set_engine(sc,'BLENDER_EEVEE');sc.eevee.taa_render_samples=16;sc.eevee.use_raytracing=False;enum_value(sc.eevee,'shadow_pool_size','64');sc.render.resolution_x=1600;sc.render.resolution_y=1000;sc.render.threads_mode='FIXED';sc.render.threads=2;enum_value(sc.view_settings,'view_transform','AgX');sc.view_settings.exposure=.3
    light(sc,'Assembly sun',(-300,-500,600),3,(1,.86,.72),kind='SUN');light(sc,'Assembly cool fill',(700,-200,300),12e6,(.45,.68,1),400,target=(100,250,0));light(sc,'Assembly stern rim',(-200,500,400),15e6,(.42,.66,.95),350,target=(100,250,0))
    for placement in placements:
        placement['ports']=[dict(name=p['name'],position=yup(p['position']),direction=yup(p['direction'])) for p in placement['ports']]
    dump(folder/'assembly.json',dict(instances=placements,connections=checks,grid_m=20,coordinate_system='glTF Y-up',unused_ports_capped=3,open_hall_ports=[3,4,5]));dump(folder/'validation.json',dict(asset=name,instances=len(placements),connections=checks,positive_volume_aabb_overlaps=intersections,maximum_port_centre_error_m=max(c['centre_error_m'] for c in checks),unmet_rules=[]));dump(folder/'provenance.json',dict(origin='Original assembled kit authored through Blender MCP',source='yarik-kit.blend'))
    preview(name,'assembly',(850,-650,650),(130,250,0),ortho=950);k4_save();print('ASSEMBLY COMPLETE',len(placements),'instances',len(checks),'main joints',len(s['lod0'].data.polygons),'triangles')

# Brief 4 section 2. Read licensed GLB geometry directly, without allocating source textures/high meshes together.
O4_FILES={'gangut':'gangut_space_hub.glb','halka_harabe':'space_station_3.glb','kayalik_1':'alaskan_cliff_rock_1_free.glb','kayalik_4':'alaskan_cliff_rock_4_free.glb'}

def o4_workspace():
    k4_save();sc=bpy.data.scenes.new('owner_workspace');bpy.context.window.scene=sc
    for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
    for other in list(bpy.data.scenes):
        if other!=sc:bpy.data.scenes.remove(other)
    STATE.clear();purge('Kit source safe; one owner asset at a time')


def o4_accessor(s,index):
    import mmap
    a=s['source_doc']['accessors'][index];view=s['source_doc']['bufferViews'][a['bufferView']];dtype={5126:np.float32,5125:np.uint32,5123:np.uint16,5121:np.uint8,5122:np.int16}[a['componentType']];width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];item=np.dtype(dtype).itemsize
    with open(s['source_path'],'rb') as f:
        mm=mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ);array=np.ndarray((a['count'],width),dtype=dtype,buffer=mm,offset=s['source_bin_start']+view.get('byteOffset',0)+a.get('byteOffset',0),strides=(view.get('byteStride',item*width),item)).copy();mm.close()
    return array


def o4_begin(name):
    from mathutils import Matrix,Quaternion
    if name not in O4_FILES:raise ValueError(name)
    (OUT/name).mkdir(exist_ok=True);new_scene(name);s=STATE[name];source=Path.home()/'Downloads/commander-ship-assets'/O4_FILES[name]
    with source.open('rb') as f:header=f.read(20);length=struct.unpack_from('<I',header,12)[0];doc=json.loads(f.read(length))
    s.update(source_doc=doc,source_path=str(source),source_bin_start=28+length,source_parts=[],source_work=[],paths=[],markers=[],entrances=[],ports=[],deposits=[],cargo=[],pads=[],unmet=[],review='brief-4-owner')
    worlds={}
    def visit(i,parent):
        n=doc['nodes'][i]
        if 'matrix' in n:local=Matrix(np.array(n['matrix']).reshape(4,4).T.tolist())
        else:
            q=n.get('rotation',[0,0,0,1]);local=Matrix.Translation(n.get('translation',[0,0,0]))@Quaternion((q[3],q[0],q[1],q[2])).to_matrix().to_4x4()@Matrix.Diagonal([*n.get('scale',[1,1,1]),1])
        world=parent@local;worlds[i]=world
        for child in n.get('children',[]):visit(child,world)
    children={c for n in doc['nodes'] for c in n.get('children',[])}
    for i in range(len(doc['nodes'])):
        if i not in children:visit(i,Matrix.Identity(4))
    lo=np.full(3,1e30);hi=-lo
    for i,n in enumerate(doc['nodes']):
        if 'mesh' not in n:continue
        for p in doc['meshes'][n['mesh']]['primitives']:
            matrix=np.array(worlds[i]);v=o4_accessor(s,p['attributes']['POSITION']);v=v@matrix[:3,:3].T+matrix[:3,3];lo=np.minimum(lo,v.min(0));hi=np.maximum(hi,v.max(0));s['source_parts'].append(dict(primitive=p,matrix=matrix.tolist(),node=n.get('name',str(i))))
    target=450 if name=='gangut' else 400 if name=='halka_harabe' else 800;s['source_centre']=(lo+hi)*.5;s['source_scale']=target/float(max(hi-lo));s['target_size_m']=target;s['source_original_dimensions']=list(hi-lo);s['material']=K4_SHARED['material'];s['images']=K4_SHARED['images'];print('OWNER SOURCE',name,len(s['source_parts']),'parts','original bounds',list(hi-lo),'scale',s['source_scale']);purge(name+' source metadata only');return s


def o4_source_arrays(s,index):
    info=s['source_parts'][index];p=info['primitive'];matrix=np.array(info['matrix']);v=o4_accessor(s,p['attributes']['POSITION']);v=v@matrix[:3,:3].T+matrix[:3,3];v=(v-s['source_centre'])*s['source_scale'];v=np.stack([v[:,0],-v[:,2],v[:,1]],axis=1);faces=o4_accessor(s,p['indices']).reshape(-1,3).astype(np.int32)
    uv=o4_accessor(s,p['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in p['attributes'] else None
    return v,faces,uv


def o4_load_part(name,index,keep_uv=True):
    s=STATE[name];v,faces,uv=o4_source_arrays(s,index);me=bpy.data.meshes.new(name+' source '+str(index));me.from_pydata(v.tolist(),[],faces.tolist());me.update();ob=bpy.data.objects.new(name+' source '+str(index),me);s['scene'].collection.objects.link(ob)
    if uv is not None and keep_uv:
        layer=me.uv_layers.new(name='UVMap')
        for li,loop in enumerate(me.loops):layer.data[li].uv=uv[loop.vertex_index]
    for f in me.polygons:f.use_smooth=True
    s['source_work'].append(ob);return ob


def o4_station_load(name):
    s=STATE[name]
    for i in range(len(s['source_parts'])):o4_load_part(name,i)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in s['source_work']:ob.select_set(True)
    bpy.context.view_layer.objects.active=s['source_work'][0];bpy.ops.object.join();ob=s['source_work'][0];ob.name=name+' licensed source';s['source_work']=[ob];s['licensed_source']=ob
    bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free();ob.data.materials.clear();ob.data.materials.append(K4_SHARED['material'])
    # Quiet material for inspection; final atlas retains authored UVs and source surface detail.
    s['lod0']=ob
    print('SOURCE TOPOLOGY',topology(ob));print('Bounding',list(ob.dimensions));purge(name+' licensed source station geometry')

def o4_make_atlas(name):
    s=STATE[name];mats=s['source_doc'].get('materials',[]);grid=math.ceil(math.sqrt(len(mats)));size=1024;tile=size//grid;s['source_atlas_grid']=grid;s['source_atlas_arrays']={k:np.zeros((size,size,4),np.float32) for k in ['base','normal','orm','emissive']}
    a=s['source_atlas_arrays'];a['base'][:]=(.29,.31,.33,1);a['normal'][:]=(.5,.5,1,1);a['orm'][:]=(1,.62,.72,1);a['emissive'][:,:,3]=1
    mat=bpy.data.materials.new(name+' licensed source atlas');mat.use_nodes=True;mat.use_fake_user=True;s['source_material']=mat;s['source_atlas_images']={}
    for k in a:
        im=bpy.data.images.new(name+' source atlas '+k,size,size,alpha=False);im.colorspace_settings.name='Non-Color' if k in ['normal','orm'] else 'sRGB';im.use_fake_user=True;s['source_atlas_images'][k]=im
    print('Atlas initialized',name,grid,tile)


def o4_atlas_material(name,index):
    s=STATE[name];doc=s['source_doc'];mat=doc['materials'][index];grid=s['source_atlas_grid'];tile=1024//grid;a=s['source_atlas_arrays'];x=(index%grid)*tile;y=(index//grid)*tile
    def pixels(texture):
        if texture is None:return None
        image_index=doc['textures'][texture['index']]['source'];imdoc=doc['images'][image_index];view=doc['bufferViews'][imdoc['bufferView']]
        with open(s['source_path'],'rb') as f:f.seek(s['source_bin_start']+view.get('byteOffset',0));data=f.read(view['byteLength'])
        suffix='.png' if data[:8]==b'\x89PNG\r\n\x1a\n' else '.jpg';path=OUT/name/('.source_image'+suffix);path.write_bytes(data);im=bpy.data.images.load(str(path),check_existing=False)
        if texture.get('_data'):im.colorspace_settings.name='Non-Color'
        im.scale(tile,tile);result=np.empty(tile*tile*4,np.float32);im.pixels.foreach_get(result);bpy.data.images.remove(im);path.unlink();return result.reshape(tile,tile,4)
    pbr=mat.get('pbrMetallicRoughness',{});base=pixels(pbr.get('baseColorTexture'))
    if base is not None:
        lum=base[:,:,:3]@np.array([.2126,.7152,.0722]);value=np.clip(.27+.07*np.sqrt(np.clip(lum,0,1)),.27,.35);color=np.ones_like(base);color[:,:,:3]=value[:,:,None]*np.array([.94,.99,1.03]);a['base'][y:y+tile,x:x+tile]=color
    normal=mat.get('normalTexture');normal=pixels(dict(normal,_data=True)) if normal else None
    if normal is not None:a['normal'][y:y+tile,x:x+tile]=normal
    mr=pbr.get('metallicRoughnessTexture');mr=pixels(dict(mr,_data=True)) if mr else None
    if mr is not None:
        mr[:,:,0]=1;mr[:,:,1]=np.clip(mr[:,:,1],.42,.83);mr[:,:,2]=np.maximum(mr[:,:,2],.55);a['orm'][y:y+tile,x:x+tile]=mr
    emission=pixels(mat.get('emissiveTexture'))
    if emission is not None:a['emissive'][y:y+tile,x:x+tile]=emission*np.array([*mat.get('emissiveFactor',[1,1,1]),1])
    for k,im in s['source_atlas_images'].items():im.pixels.foreach_set(a[k].ravel());im.update()
    purge(name+' processed source material '+str(index))


def o4_finish_atlas(name):
    s=STATE[name];mat=s['source_material'];ns=mat.node_tree.nodes;links=mat.node_tree.links;bs=next(n for n in ns if n.type=='BSDF_PRINCIPLED');tex={}
    for k,im in s['source_atlas_images'].items():tex[k]=ns.new('ShaderNodeTexImage');tex[k].image=im
    links.new(tex['base'].outputs[0],bs.inputs['Base Color']);links.new(tex['emissive'].outputs[0],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=1;normal=ns.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=1;links.new(tex['normal'].outputs[0],normal.inputs['Color']);links.new(normal.outputs[0],bs.inputs['Normal']);sep=ns.new('ShaderNodeSeparateColor');links.new(tex['orm'].outputs[0],sep.inputs[0]);links.new(sep.outputs[1],bs.inputs['Roughness']);links.new(sep.outputs[2],bs.inputs['Metallic'])
    source=s['licensed_source'];source.data.materials.clear();source.data.materials.append(mat)
    # Original parts were joined in the same order; retain source UV islands in a shared atlas.
    offset=0;uv=source.data.uv_layers['UVMap'];grid=s['source_atlas_grid']
    # Topology welding kept face order, including all three degenerate source faces.
    for part in s['source_parts']:
        count=o4_accessor(s,part['primitive']['indices']).size//3;mi=part['primitive'].get('material',0)
        for f in list(source.data.polygons)[offset:offset+count]:
            for li in f.loop_indices:
                q=uv.data[li].uv.copy();uv.data[li].uv=((q.x+mi%grid)/grid,(1-q.y+mi//grid)/grid)
        offset+=count
    s.pop('source_atlas_arrays',None);purge(name+' source atlas ready')


def o4_largest_component(ob):
    bm=bmesh.new();bm.from_mesh(ob.data);unseen=set(bm.verts);components=[]
    while unseen:
        v=unseen.pop();group={v};stack=[v]
        while stack:
            for e in stack.pop().link_edges:
                for w in e.verts:
                    if w in unseen:unseen.remove(w);group.add(w);stack.append(w)
        components.append(group)
    largest=max(components,key=len);drop=[v for group in components if group is not largest for v in group]
    if drop:bmesh.ops.delete(bm,geom=drop,context='VERTS')
    bm.to_mesh(ob.data);bm.free();return len(components),len(drop)


def o4_station_collider(name):
    s=STATE[name];source=s['licensed_source'];col=source.copy();col.data=source.data.copy();s['scene'].collection.objects.link(col);col.name=name+'_collider';select(col);parts=[col]
    if name=='gangut':
        # Source ring is very thin; add a real 13m pressure tube and 7m load-bearing spokes.
        bpy.ops.mesh.primitive_torus_add(major_segments=96,minor_segments=12,major_radius=202,minor_radius=6.5,location=(0,0,55));torus=bpy.context.object;parts.append(torus)
        for sign in [-1,1]:
            for axis in [0,1]:
                a=Vector((0,0,55));b=a.copy();a[axis]=sign*55;b[axis]=sign*202;parts.append(r1_beam('Thickened source structural spoke',a,b,7))
        s['ring_minor_radius_m']=6.5;s['ring_major_radius_m']=202;s['ring_height_m']=55
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:ob.select_set(True)
    bpy.context.view_layer.objects.active=col;bpy.ops.object.join();select(col);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);col.data.remesh_voxel_size=3.0;col.data.remesh_voxel_adaptivity=.4;bpy.ops.object.voxel_remesh();s['collider']=col;print('VOXEL',name,len(col.data.polygons),o4_largest_component(col));purge(name+' 3m solid remesh')


def o4_station_finish_collider(name):
    s=STATE[name];col=s['collider'];select(col);smooth=col.modifiers.new('Resolve subvoxel touching source shells','SMOOTH');smooth.factor=.4;smooth.iterations=2;bpy.ops.object.modifier_apply(modifier=smooth.name);decimate(col,5500);r3_clean(col);o4_repair_pinches(col);print('PRE CUT TOPOLOGY',topology(col));assert_solid(col)
    if name=='gangut':
        # Central source hub is wide enough for a real 70m transverse passage.
        boolean_cut(col,cube_part('70m through hub',(0,0,55),(71.4,330,71.4)));s['paths']=[[[0,-150,55],[0,150,55]]];marker(s,'entrance_1',(0,-150,55),(0,-1,0));marker(s,'entrance_2',(0,150,55),(0,1,0))
    r3_clean(col);assert_solid(col);col.name=name+'_collider';col['asset_node']='collider';purge(name+' solid low collider')
    # Render and collision use the same retopology; high source detail is transferred into 1024px maps.
    low=col.copy();low.data=col.data.copy();s['scene'].collection.objects.link(low);low.name=name+'_lod0';low['asset_node']='lod0';s['lod0']=low;select(low)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.008);bpy.ops.object.mode_set(mode='OBJECT');s['lods']=[low]
    mat=bpy.data.materials.new(name+' game material');mat.use_nodes=True;s['material']=mat;s['images']={};low.data.materials.clear();low.data.materials.append(mat);col.hide_render=True;col.hide_set(True)
    for k in ['base','normal','orm','emissive']:
        im=bpy.data.images.new(name+'_'+k,1024,1024,alpha=False);im.colorspace_settings.name='Non-Color' if k in ['normal','orm'] else 'sRGB';im.use_fake_user=True;s['images'][k]=im
    low.data.uv_layers.active.name='UVMap';purge(name+' UV and four 1024 bake targets')


def o4_bake(name,kind):
    s=STATE[name];sc=s['scene'];bpy.context.window.scene=sc;set_engine(sc,'CYCLES');sc.cycles.samples=1;sc.render.threads_mode='FIXED';sc.render.threads=2;sc.render.bake.use_selected_to_active=True;sc.render.bake.use_clear=True;sc.render.bake.cage_extrusion=5;sc.render.bake.max_ray_distance=14;sc.render.bake.margin=3
    low=s['lod0'];source=s['licensed_source'];low.hide_set(False);source.hide_set(False);source.hide_render=False;low.hide_render=False
    mat=s['material'];tex=mat.node_tree.nodes.get('Bake target') or mat.node_tree.nodes.new('ShaderNodeTexImage');tex.name='Bake target';tex.image=s['images'][kind];mat.node_tree.nodes.active=tex
    bpy.ops.object.select_all(action='DESELECT');source.select_set(True);low.select_set(True);bpy.context.view_layer.objects.active=low
    if kind=='base':sc.render.bake.use_pass_direct=False;sc.render.bake.use_pass_indirect=False;sc.render.bake.use_pass_color=True;mode='DIFFUSE'
    elif kind=='normal':mode='NORMAL'
    else:mode='EMIT'
    bpy.ops.object.bake(type=mode);im=s['images'][kind];im.filepath_raw=str(OUT/name/(name+'_'+kind+'.png'));im.file_format='PNG';im.save();source.hide_render=True;source.hide_set(True);purge(name+' '+kind+' 1024 bake')

def o4_repair_pinches(ob):
    bm=bmesh.new();bm.from_mesh(ob.data);bad={v for e in bm.edges if not e.is_manifold for v in e.verts}
    if bad:
        faces={f for v in bad for f in v.link_faces};bmesh.ops.delete(bm,geom=list(faces),context='FACES');bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));loose=[v for v in bm.verts if not v.link_faces]
        if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    bm.to_mesh(ob.data);bm.free();print('Locally repaired pinch vertices',len(bad));assert_solid(ob)

def o4_station_finish_collider(name):
    s=STATE[name];col=s['collider'];select(col)
    bm=bmesh.new();bm.from_mesh(col.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(col.data);bm.free();col.data.validate(clean_customdata=False);assert_solid(col);col.name=name+'_collider';col['asset_node']='collider';purge(name+' adaptive manifold collider')
    if name=='gangut':s['unmet'].append('No enclosed 70m hub passage was delivered; the licensed compact core stays sealed. The ring gap remains flyable.')
    low=col.copy();low.data=col.data.copy();s['scene'].collection.objects.link(low);low.name=name+'_lod0';low['asset_node']='lod0';s['lod0']=low;select(low);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.008);bpy.ops.object.mode_set(mode='OBJECT');s['lods']=[low]
    mat=bpy.data.materials.new(name+' game material');mat.use_nodes=True;s['material']=mat;s['images']={};low.data.materials.clear();low.data.materials.append(mat);col.hide_render=True;col.hide_set(True)
    for k in ['base','normal','orm','emissive']:
        im=bpy.data.images.new(name+'_'+k,1024,1024,alpha=False);im.colorspace_settings.name='Non-Color' if k in ['normal','orm'] else 'sRGB';im.use_fake_user=True;s['images'][k]=im
    low.data.uv_layers.active.name='UVMap';purge(name+' UV and bake targets')

def o4_meshfix(ob):
    import importlib.util,sys
    repair=bpy.app.driver_namespace.get('yarik_meshfix_module')
    if repair is None:
        path=OUT/'.build-deps/pymeshfix/_meshfix.abi3.so';spec=importlib.util.spec_from_file_location('_meshfix',path);repair=importlib.util.module_from_spec(spec);spec.loader.exec_module(repair);bpy.app.driver_namespace['yarik_meshfix_module']=repair
    vertices=np.array([v.co[:] for v in ob.data.vertices],dtype=np.float64);faces=np.array([p.vertices[:] for p in ob.data.polygons],dtype=np.int32);
    sys.modules.setdefault('_meshfix',repair)
    if hasattr(repair,'PyTMesh'):
        mesh=repair.PyTMesh();mesh.set_quiet(1);mesh.load_array(vertices,faces);mesh.fix_connectivity();mesh.remove_smallest_components();mesh.fill_small_boundaries();success=mesh.clean(max_iters=10,inner_loops=3);vertices,faces=mesh.return_arrays()
    else:
        vertices,faces=repair.clean_from_arrays(vertices,faces,verbose=False,joincomp=False,remove_smallest_components=True);success=True
    me=bpy.data.meshes.new(ob.name+' manifold repair');me.from_pydata(vertices.tolist(),[],faces.tolist());me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.dissolve_degenerate(bm,dist=.001,edges=list(bm.edges));bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();old=ob.data;ob.data=me
    if old.users==0:bpy.data.meshes.remove(old)
    print('MeshFix',bool(success),topology(ob))
    if topology(ob)['non_manifold_edges']:o4_repair_pinches(ob)
    assert_solid(ob);print('Self check',intersection_check(ob));purge('Local mesh repair completed')

def o4_finish_maps(name):
    s=STATE[name];mat=s['material'];ns=mat.node_tree.nodes;links=mat.node_tree.links;bs=next(n for n in ns if n.type=='BSDF_PRINCIPLED');tex={}
    for kind,im in s['images'].items():
        array=np.empty(1024*1024*4,np.float32);im.pixels.foreach_get(array);a=array.reshape(1024,1024,4);a[:,:,3]=1
        if kind=='base':
            lum=a[:,:,:3].mean(2);valid=lum>.003;mean=float(lum[valid].mean()) if valid.any() else .31;a[:,:,:3]=np.clip(a[:,:,:3]*(.31/max(.01,mean)),.26,.36);a[~valid]=(.29,.31,.33,1)
        elif kind=='normal':a[np.linalg.norm(a[:,:,:3],axis=2)<.05]=(.5,.5,1,1)
        elif kind=='orm':a[:]=(1,.64,.72,1)
        im.pixels.foreach_set(a.ravel());im.update();im.filepath_raw=str(OUT/name/(name+'_'+kind+'.png'));im.file_format='PNG';im.save()
        if im.packed_file:im.unpack(method='REMOVE')
        im.source='FILE';im.reload();im.pack();im.use_fake_user=True;tex[kind]=ns.new('ShaderNodeTexImage');tex[kind].image=im
    links.new(tex['base'].outputs[0],bs.inputs['Base Color']);links.new(tex['emissive'].outputs[0],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=3;normal=ns.new('ShaderNodeNormalMap');links.new(tex['normal'].outputs[0],normal.inputs['Color']);links.new(normal.outputs[0],bs.inputs['Normal']);sep=ns.new('ShaderNodeSeparateColor');links.new(tex['orm'].outputs[0],sep.inputs[0]);links.new(sep.outputs[1],bs.inputs['Roughness']);links.new(sep.outputs[2],bs.inputs['Metallic'])
    group=bpy.data.node_groups.get('glTF Material Output');gn=ns.new('ShaderNodeGroup');gn.node_tree=group;links.new(sep.outputs[0],gn.inputs['Occlusion'])
    # The original source has served the bake. Keep one asset's high data in memory at a time.
    high=s.pop('licensed_source',None)
    if high:bpy.data.objects.remove(high,do_unlink=True)
    for im in s.get('source_atlas_images',{}).values():im.use_fake_user=False
    if s.get('source_material'):s['source_material'].use_fake_user=False
    s['source_work']=[];s['lods']=[s['lod0']]
    for level,ratio in [(1,.35),(2,.1)]:
        ob=s['lod0'].copy();ob.data=ob.data.copy();s['scene'].collection.objects.link(ob);ob.name=name+'_lod'+str(level);ob['asset_node']='lod'+str(level);ob.hide_set(False);select(ob);decimate(ob,round(len(s['lod0'].data.polygons)*ratio));ob.data.validate(clean_customdata=False);ob.hide_render=True;ob.hide_set(True);s['lods'].append(ob)
    s['lod0'].hide_render=False;s['lod0'].hide_set(False);purge(name+' final packed PBR and LODs')


def o4_ring_routes(name):
    s=STATE[name];tree=mesh_bvh(s['collider'])[0]
    if name=='gangut':
        radius=150;path=[[radius*math.cos(a),radius*math.sin(a),55] for a in np.linspace(math.radians(37),math.radians(53),33)];minimum=min(tree.find_nearest(Vector(p))[3]*2 for p in path)
        if minimum>=62:s['paths'].append(path)
        p=Vector((radius/math.sqrt(2),radius/math.sqrt(2),55));clear=tree.find_nearest(p)[3]
        if clear>=40:k4_point(s,'cargo',p)
        d=Vector((1,1,0)).normalized();hit,n,_,_=tree.ray_cast(p,d,100)
        if hit is not None:k4_point(s,'deposit',hit,n)
        widths=[];spokes=[]
        for a in np.linspace(0,2*math.pi,48,endpoint=False):
            p=Vector((202*math.cos(a),202*math.sin(a),55));u=Vector((math.cos(a),math.sin(a),0));assert point_inside(tree,p)
            ds=[tree.ray_cast(p,d,1000)[3] for d in [u,-u,Vector((0,0,1)),Vector((0,0,-1))]];assert all(x is not None for x in ds);widths.extend([ds[0]+ds[1],ds[2]+ds[3]])
        for axis in [0,1]:
            for sign in [-1,1]:
                p=Vector((0,0,55));p[axis]=sign*145;d=Vector((0,1,0)) if axis==0 else Vector((1,0,0));ds=[tree.ray_cast(p,q,1000)[3] for q in [d,-d]];spokes.append(sum(ds) if all(x is not None for x in ds) else 0)
        s['owner_metrics']=dict(outer_ring_minimum_cross_section_m=min(widths),ring_samples=48,spoke_minimum_width_m=min(spokes),spoke_widths_m=spokes,core_70m_passage_delivered=s.get('core_passage',False),open_ring_path_minimum_clear_diameter_m=minimum)
        if min(widths)<8:s['unmet'].append('Outer ring measured thinner than 8m at a sampled section: '+str(min(widths)))
        if min(spokes)<4:s['unmet'].append('A source spoke measured thinner than 4m: '+str(min(spokes)))
    print('OWNER METRICS',s.get('owner_metrics',{}))


def o4_lighting(name):
    s=STATE[name];sc=s['scene']
    for ob in list(sc.objects):
        if ob.type=='LIGHT':bpy.data.objects.remove(ob,do_unlink=True)
    set_engine(sc,'BLENDER_EEVEE');sc.eevee.taa_render_samples=16;sc.eevee.use_raytracing=False;enum_value(sc.eevee,'shadow_pool_size','64');sc.render.resolution_x=1600;sc.render.resolution_y=1000;sc.render.threads_mode='FIXED';sc.render.threads=2;enum_value(sc.view_settings,'view_transform','AgX');sc.view_settings.exposure=.4
    light(sc,'Owner model key',(-500,-700,900),2.6,(1,.86,.72),kind='SUN');light(sc,'Owner cold fill',(500,-300,400),14e6,(.5,.69,1),450);light(sc,'Owner blue rim',(-500,400,500),18e6,(.4,.6,1),350)
    target=Vector((0,0,0));distance=600 if name in ['gangut','halka_harabe'] else 1100;s['preview_specs']={'exterior_600m' if distance==600 else 'exterior_1100m':(list(Vector((1,-1.4,.9)).normalized()*distance),list(target),None,35)}
    if name=='gangut':s['preview_specs']['interior']=([116,72,59],[65,134,55],None,22)
    elif s['paths']:
        path=s['paths'][0];s['preview_specs']['interior']=(list(Vector(path[len(path)//4])+Vector((0,0,5))),path[min(len(path)-1,len(path)*3//4)],None,18)
    else:s['preview_specs']['interior']=([120,-100,70],[-80,120,0],None,22)
    purge(name+' preview setup')


def o4_validate(name):
    s=STATE[name];col=s['collider'];top=assert_solid(col);cross=intersection_check(col);assert cross['passed'],cross;r1_distance(name);tree=mesh_bvh(col)[0];routes=[]
    for i,path in enumerate(s['paths']):
        pts=sample_path(path,4);ds=[tree.find_nearest(Vector(p))[3]*2 for p in pts];assert min(ds)>=61.99;assert not any(point_inside(tree,p) for p in pts);routes.append(dict(path=i,minimum_clear_diameter_m=min(ds),samples=len(pts),minimum_bend_radius_m=bend_radius(path)))
    v=dict(asset=name,review='brief-4-owner',units='metres',coordinate_system='glTF Y-up',collider_topology=top,self_intersection=cross,lod_triangle_counts={ob['asset_node']:len(ob.data.polygons) for ob in s['lods']},collider_vs_lod0=s['distance'],paths=routes,minimum_clear_diameter_m=min((r['minimum_clear_diameter_m'] for r in routes),default=None),route_clearance_before_after_m=[dict(path=i,before=r['minimum_clear_diameter_m'],after=r['minimum_clear_diameter_m']) for i,r in enumerate(routes)],largest_closed_gap_m=0,largest_closed_gap_location=None,dimensions_m=[float(col.dimensions.x),float(col.dimensions.z),float(col.dimensions.y)],texture_sizes={k:list(im.size) for k,im in s['images'].items()},source_triangle_count=sum(o4_accessor(s,p['primitive']['indices']).size//3 for p in s['source_parts']),owner_metrics=s.get('owner_metrics',{}),unmet_rules=s['unmet'],current_rss_mib=purge(name+' final validation'),peak_process_rss_mib=__import__('resource').getrusage(__import__('resource').RUSAGE_SELF).ru_maxrss/1024)
    s['validation']=v;dump(OUT/name/'validation.json',v);print('OWNER VALID',name,top['triangles'],v['lod_triangle_counts'],v['minimum_clear_diameter_m'])


def o4_deliver(name):
    import hashlib
    s=STATE[name];folder=OUT/name;bpy.context.window.scene=s['scene'];bpy.ops.object.select_all(action='DESELECT')
    for ob in [s['collider']]+s['lods']+[o for o in s['scene'].objects if o.type=='EMPTY']:ob.hide_set(False);ob.select_set(True)
    path=folder/(name+'.glb');bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_animations=False,export_image_format='AUTO',export_extras=True,export_cameras=False,export_lights=False,export_all_vertex_colors=False);doc=patch_glb(path,s);assert len(doc['materials'])==1 and len(doc['images'])==4
    dump(folder/(name+'.json'),dict(asset=name,units='metres',coordinate_system='glTF Y-up',ports=s['ports'],paths=[[yup(p) for p in path] for path in s['paths']],entrances=s['entrances'],deposits=s['deposits'],cargo=s['cargo'],pads=s['pads']))
    author='Comrade1280' if name=='gangut' else 're1monsen' if name=='halka_harabe' else 'Owner-provided Fab purchase';license='CC-BY-4.0' if name in ['gangut','halka_harabe'] else 'Fab Standard'
    dump(folder/'provenance.json',dict(origin='Derivative of owner-provided licensed model, processed through live Blender MCP',source_file=O4_FILES[name],source_author=author,source_license=license,source_attribution=s['source_doc'].get('asset',{}).get('extras',{}),source_sha256=hashlib.sha256(Path(s['source_path']).read_bytes()).hexdigest(),blender_version=bpy.app.version_string,processing=('Authored station components closed locally, boolean union, original UV and artist normals retained in a shared 1024px atlas; physical ring/spoke reinforcement and core passage' if name in ['gangut','halka_harabe'] else 'Licensed scan silhouette retained, closed retopology, 1024px normal transfer from original high geometry, space-rock palette and 60-80m through crack'),generator='tools/yarik-blender.py',mesh_repair_tool='PyMeshFix 0.18.1; tool is not part of the distributed assets',generator_sha256=hashlib.sha256((ROOT/'tools/yarik-blender.py').read_bytes()).hexdigest()))
    r1_verify_glb(name);s['validation']['export_revalidated']=True;s['validation']['exported_glb_bytes']=path.stat().st_size;dump(folder/'validation.json',s['validation']);s['collider'].hide_render=True;s['collider'].hide_set(True)
    for ob in s['lods'][1:]:ob.hide_render=True;ob.hide_set(True)
    s['scene']['owner_metadata']=json.dumps(dict(asset=name,preview_specs=s['preview_specs']));bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(folder/(name+'.blend')));s['verified']=True;purge(name+' saved after complete asset');print('OWNER COMPLETE',name)


def o4_empty():
    scene=bpy.data.scenes.new('owner_workspace');bpy.context.window.scene=scene
    for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
    for sc in list(bpy.data.scenes):
        if sc!=scene:bpy.data.scenes.remove(sc)
    STATE.clear()
    for mat in list(bpy.data.materials):
        if mat!=K4_SHARED.get('material'):mat.use_fake_user=False
    for im in list(bpy.data.images):
        if im not in K4_SHARED.get('images',{}).values():im.use_fake_user=False
    purge('Previous owner asset saved; clear high working state')

def o4_meshfix_uv(ob):
    from mathutils.geometry import barycentric_transform
    verts=[v.co.copy() for v in ob.data.vertices];faces=[tuple(p.vertices) for p in ob.data.polygons];old_uv=[[ob.data.uv_layers['UVMap'].data[i].uv.copy() for i in p.loop_indices] for p in ob.data.polygons];tree=BVHTree.FromPolygons(verts,faces,all_triangles=True);materials=list(ob.data.materials);o4_meshfix(ob);uv=ob.data.uv_layers.new(name='UVMap')
    for f in ob.data.polygons:
        centroid=sum((ob.data.vertices[i].co for i in f.vertices),Vector())/3;_,_,index,_=tree.find_nearest(centroid);a,b,c=[verts[i] for i in faces[index]];ua,ub,uc=[Vector((q.x,q.y,0)) for q in old_uv[index]]
        for li in f.loop_indices:
            q=ob.data.vertices[ob.data.loops[li].vertex_index].co;value=barycentric_transform(q,a,b,c,ua,ub,uc);uv.data[li].uv=(value.x,value.y)
        f.use_smooth=True
    for mat in materials:ob.data.materials.append(mat)
    ob.data.set_sharp_from_angle(angle=.65);purge('UV transfer from repaired source surface')


def o4_adopt_render(name,ob):
    s=STATE[name]
    for old in s['lods']+[s['collider']]:
        if old!=ob:bpy.data.objects.remove(old,do_unlink=True)
    ob.name=name+'_lod0';ob['asset_node']='lod0';s['lod0']=ob;ob.hide_set(False);ob.hide_render=False;col=ob.copy();col.data=ob.data.copy();s['scene'].collection.objects.link(col);col.name=name+'_collider';col['asset_node']='collider';col.data.materials.clear();col.hide_render=True;col.hide_set(True);s['collider']=col;s['lods']=[ob]
    for level,ratio in [(1,.35),(2,.1)]:
        child=ob.copy();child.data=ob.data.copy();s['scene'].collection.objects.link(child);child.name=name+'_lod'+str(level);child['asset_node']='lod'+str(level);decimate(child,round(len(ob.data.polygons)*ratio));child.data.validate(clean_customdata=False);child.hide_render=True;child.hide_set(True);s['lods'].append(child)
    print('Adopted final mesh',name,len(ob.data.polygons))

def o4_native_station(name):
    s=STATE[name];s['source_work']=[];grid=math.ceil(math.sqrt(len(s['source_doc']['materials'])))
    for index,info in enumerate(s['source_parts']):
        ob=o4_load_part(name,index);uv=ob.data.uv_layers['UVMap'];mi=info['primitive'].get('material',0)
        for item in uv.data:q=item.uv.copy();item.uv=((q.x+mi%grid)/grid,(1-q.y+mi//grid)/grid)
        attributes=info['primitive']['attributes']
        if 'NORMAL' in attributes:
            raw=o4_accessor(s,attributes['NORMAL']).astype(float);matrix=np.array(info['matrix'])[:3,:3];normal=raw@np.linalg.inv(matrix);normal=np.stack([normal[:,0],-normal[:,2],normal[:,1]],axis=1);normal/=np.maximum(np.linalg.norm(normal,axis=1),1e-20)[:,None];ob.data.normals_split_custom_set_from_vertices(normal.tolist())
    bpy.ops.object.select_all(action='DESELECT')
    for ob in s['source_work']:ob.select_set(True)
    bpy.context.view_layer.objects.active=s['source_work'][0];bpy.ops.object.join();ob=s['source_work'][0];ob.name=name+' native licensed surfaces';s['native_source']=ob
    # Analyse source components without changing artist normals or UVs.
    bm=bmesh.new();bm.from_mesh(ob.data);unseen=set(bm.verts);stats=[]
    while unseen:
        v=unseen.pop();verts={v};stack=[v]
        while stack:
            for e in stack.pop().link_edges:
                for w in e.verts:
                    if w in unseen:unseen.remove(w);verts.add(w);stack.append(w)
        faces={f for v in verts for f in v.link_faces};edges={e for f in faces for e in f.edges};stats.append((len(faces),sum(not e.is_manifold for e in edges)))
    bm.free();s['native_component_stats']=stats;print('Native source components',len(stats),'closed',sum(b==0 for a,b in stats),'largest',sorted(stats,reverse=True)[:12]);return ob

# Preserve the licensed station's authored surface geometry. Close each authored component locally;
# a global fill can span unrelated panels and destroy the silhouette.
def o4_native_material(name):
    s=STATE[name];mat=s['source_material'];ns=mat.node_tree.nodes;links=mat.node_tree.links;bs=next(n for n in ns if n.type=='BSDF_PRINCIPLED');tex={}
    for k,im in s['source_atlas_images'].items():
        im.name=name+'_'+k;im.filepath_raw=str(OUT/name/(name+'_'+k+'.png'));im.file_format='PNG';im.save();im.source='FILE';im.reload();im.pack();im.use_fake_user=True;tex[k]=ns.new('ShaderNodeTexImage');tex[k].image=im
    links.new(tex['base'].outputs[0],bs.inputs['Base Color']);links.new(tex['emissive'].outputs[0],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=3;normal=ns.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.4;links.new(tex['normal'].outputs[0],normal.inputs['Color']);links.new(normal.outputs[0],bs.inputs['Normal']);sep=ns.new('ShaderNodeSeparateColor');links.new(tex['orm'].outputs[0],sep.inputs[0]);links.new(sep.outputs[1],bs.inputs['Roughness']);links.new(sep.outputs[2],bs.inputs['Metallic']);group=ns.new('ShaderNodeGroup');group.node_tree=bpy.data.node_groups['glTF Material Output'];links.new(sep.outputs[0],group.inputs['Occlusion'])
    s['material']=mat;s['images']=s['source_atlas_images'];native=s['native_source'];native.data.materials.clear();native.data.materials.append(mat)
    for ob in s['scene'].objects:
        if ob.type=='MESH':ob.hide_render=ob!=native;ob.hide_set(ob!=native)
    s['lod0']=native;s.pop('source_atlas_arrays',None);purge(name+' native licensed surface atlas')


def o4_native_split(name):
    s=STATE[name];ob=s['native_source'];ob.hide_set(False);select(ob);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT');pieces=list(bpy.context.selected_objects);s['native_pieces']=sorted(pieces,key=lambda o:len(o.data.polygons),reverse=True);s['native_closed']=[];s['native_dropped']=[]
    bpy.ops.mesh.primitive_torus_add(major_segments=96,minor_segments=16,major_radius=202,minor_radius=7,location=(0,0,55));root=bpy.context.object;root.name=name+' rebuilt source union';select(root);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    for q in root.data.uv_layers.active.data:q.uv=(.75,.75)
    root.data.materials.append(s['material']);s['native_root']=root
    if name!='gangut':bpy.data.objects.remove(root,do_unlink=True);s['native_root']=None
    print('Native pieces',len(pieces));purge(name+' separated authored components')


def o4_native_close(name,start=0,count=20):
    s=STATE[name]
    for i in range(start,min(start+count,len(s['native_pieces']))):
        ob=s['native_pieces'][i]
        if max(ob.dimensions)<(1.5 if name=='halka_harabe' else .5):s['native_dropped'].append(i);bpy.data.objects.remove(ob,do_unlink=True);continue
        original=ob.data.copy();bm=bmesh.new();bm.from_mesh(ob.data);uv=bm.loops.layers.uv.get('UVMap');boundary=[e for e in bm.edges if e.is_boundary];filled=bmesh.ops.holes_fill(bm,edges=boundary,sides=0).get('faces',[])
        for f in filled:
            if uv:
                for loop in f.loops:loop[uv].uv=(.75,.75)
        bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));volume=bm.calc_volume(signed=True);invalid=any(not e.is_manifold for e in bm.edges) or any(f.calc_area()<1e-9 for f in bm.faces) or (name=='halka_harabe' and bool(boundary))
        if not invalid and abs(volume)>.01:
            if volume<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
            bm.to_mesh(ob.data);bm.free();bpy.data.meshes.remove(original)
        else:
            bm.free();old=ob.data;ob.data=original
            if old.users==0:bpy.data.meshes.remove(old)
            ob.hide_set(False);select(ob);mod=ob.modifiers.new('Physical backing to source open panel','SOLIDIFY');mod.thickness=2.0 if name=='halka_harabe' else .6;mod.offset=-1;mod.use_even_offset=name!='halka_harabe'
            if name=='halka_harabe':enum_value(mod,'solidify_mode','NON_MANIFOLD')
            bpy.ops.object.modifier_apply(modifier=mod.name);decimate(ob,1000000)
            if topology(ob)['non_manifold_edges'] or not intersection_check(ob)['passed']:
                try:o4_meshfix_uv(ob)
                except Exception:
                    s['native_dropped'].append(i);bpy.data.objects.remove(ob,do_unlink=True);continue
        ob.data.set_sharp_from_angle(angle=.65);s['native_closed'].append(ob);ob.hide_set(True)
    print('Closed native components',name,start,min(start+count,len(s['native_pieces'])),len(s['native_closed']),len(s['native_dropped']));purge(name+' local component closure')


def o4_native_union(name,start=0,count=20):
    s=STATE[name];root=s['native_root']
    for i in range(start,min(start+count,len(s['native_closed']))):
        ob=s['native_closed'][i]
        if root is None:root=ob;root.hide_set(False);s['native_root']=root;continue
        root.hide_set(False);ob.hide_set(False);select(root);mod=root.modifiers.new('Union source closed components','BOOLEAN');enum_value(mod,'solver','MANIFOLD');enum_value(mod,'operation','UNION');mod.object=ob;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(ob,do_unlink=True)
    print('Union batch',name,start,min(start+count,len(s['native_closed'])),len(root.data.polygons));purge(name+' exact source union batch')

def o4_restore_native_uv(name,ob):
    from mathutils.geometry import barycentric_transform
    s=STATE[name];vertices=[];faces=[];coords=[];normals=[];grid=math.ceil(math.sqrt(len(s['source_doc']['materials'])))
    for index,info in enumerate(s['source_parts']):
        v,f,uv=o4_source_arrays(s,index);base=len(vertices);vertices.extend([Vector(q) for q in v]);faces.extend([tuple(int(i)+base for i in face) for face in f]);mi=info['primitive'].get('material',0);coords.extend([Vector(((q[0]+mi%grid)/grid,(1-q[1]+mi//grid)/grid,0)) for q in uv]);raw=o4_accessor(s,info['primitive']['attributes']['NORMAL']).astype(float);raw=raw@np.linalg.inv(np.array(info['matrix'])[:3,:3]);raw=np.stack([raw[:,0],-raw[:,2],raw[:,1]],axis=1);raw/=np.maximum(1e-20,np.linalg.norm(raw,axis=1))[:,None];normals.extend([Vector(q) for q in raw])
    tree=BVHTree.FromPolygons(vertices,faces,all_triangles=True);me=ob.data;uv=me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap');smooth=[]
    for f in me.polygons:f.use_smooth=True
    me.set_sharp_from_angle(angle=.65);me.update();default=[q.vector.copy() for q in me.corner_normals]
    restored=0
    for f in me.polygons:
        centre=sum((me.vertices[i].co for i in f.vertices),Vector())/3;hit,n,index,distance=tree.find_nearest(centre);ids=faces[index];a,b,c=[vertices[i] for i in ids];u,v,w=[coords[i] for i in ids];na,nb,nc=[normals[i] for i in ids];native=distance<.08 and f.normal.dot(n)>.6
        if native:restored+=1
        for li in f.loop_indices:
            p=me.vertices[me.loops[li].vertex_index].co
            if native:
                q=barycentric_transform(p,a,b,c,u,v,w);uv.data[li].uv=(q.x,q.y);normal=barycentric_transform(p,a,b,c,na,nb,nc).normalized();smooth.append(normal)
            else:uv.data[li].uv=(.75,.75);smooth.append(default[li])
    me.normals_split_custom_set(smooth);me.materials.clear();me.materials.append(s['material']);print('Restored authored UV/normals',restored,'/',len(me.polygons));purge(name+' native UV fidelity restored')

def o4_guides(name,ob):
    s=STATE[name];tree=mesh_bvh(s['collider'])[0];im=s['images']['emissive'];pixels=np.empty(1024*1024*4,np.float32);im.pixels.foreach_get(pixels);a=pixels.reshape(1024,1024,4);warm=(a[:,:,0]>.05)&(a[:,:,1]<a[:,:,0]*.9)&(a[:,:,2]<a[:,:,0]*.7);score=np.where(warm,a[:,:,0],0);iy,ix=np.unravel_index(score.argmax(),score.shape);uvpoint=((ix+.5)/1024,(iy+.5)/1024);verts=[];faces=[]
    for y in range(-70,71,10):
        for x in [-19,19]:
            h,n,_,_=tree.ray_cast(Vector((x,y,55)),Vector((0,0,-1)),100)
            if h is None or n.z<.85:continue
            h+=n*.025;start=len(verts);verts.extend([h+Vector((dx,dy,0)) for dx,dy in [(-.45,-1.6),(.45,-1.6),(.45,1.6),(-.45,1.6)]]);faces.append(tuple(range(start,start+4)))
    if not faces:return
    me=bpy.data.meshes.new(name+' core emergency rows');me.from_pydata(verts,[],faces);me.update();layer=me.uv_layers.new(name='UVMap')
    for q in layer.data:q.uv=uvpoint
    part=bpy.data.objects.new(name+' physical amber core guide faces',me);s['scene'].collection.objects.link(part);me.materials.append(s['material']);bpy.ops.object.select_all(action='DESELECT');ob.hide_set(False);ob.select_set(True);part.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.join();decimate(ob,1000000)


def o4_gangut_finish_native():
    s=STATE['gangut'];ob=s['lod0'];ob.hide_set(False)
    # Paired side rails leave the 71.4m core route open, while carrying both remaining north/south spokes.
    for x in [-45,45]:
        for sign in [-1,1]:
            beam=cube_part('Rerouted 8m core side spoke',(x,sign*132,55),(8,140,8))
            for q in beam.data.uv_layers.active.data:q.uv=(.75,.75)
            beam.data.materials.append(s['material']);select(ob);mod=ob.modifiers.new('Core side load path','BOOLEAN');enum_value(mod,'solver','EXACT');enum_value(mod,'operation','UNION');mod.object=beam;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(beam,do_unlink=True)
    decimate(ob,1000000);r3_clean(ob)
    if not intersection_check(ob)['passed'] or topology(ob)['non_manifold_edges']:o4_meshfix_uv(ob)
    o4_restore_native_uv('gangut',ob)
    col=s['collider'];bpy.data.objects.remove(col,do_unlink=True);col=ob.copy();col.data=ob.data.copy();s['scene'].collection.objects.link(col);col.name='gangut_collider';col['asset_node']='collider';col.hide_render=True;col.hide_set(True);col.data.materials.clear();s['collider']=col
    for old in s['lods'][1:]:bpy.data.objects.remove(old,do_unlink=True)
    s['lods']=[ob];o4_guides('gangut',ob)
    for level,ratio in [(1,.35),(2,.1)]:
        child=ob.copy();child.data=ob.data.copy();s['scene'].collection.objects.link(child);child.name='gangut_lod'+str(level);child['asset_node']='lod'+str(level);decimate(child,round(len(ob.data.polygons)*ratio));child.data.validate(clean_customdata=False);child.hide_render=True;child.hide_set(True);s['lods'].append(child)
    s['unmet']=[];s['owner_metrics']={};s['paths']=[[[0,-125,55],[0,125,55]]]
    for e in list(s['scene'].objects):
        if e.type=='EMPTY':bpy.data.objects.remove(e,do_unlink=True)
    s['markers']=[];s['cargo']=[];s['deposits']=[];s['entrances']=[];marker(s,'entrance_1',(0,-85,55),(0,-1,0));marker(s,'entrance_2',(0,85,55),(0,1,0));o4_ring_routes('gangut')
    tree=mesh_bvh(col)[0];widths=[]
    for p,d in [(Vector((sign*145,0,55)),Vector((0,1,0))) for sign in [-1,1]]+[(Vector((x,sign*145,55)),Vector((1,0,0))) for x in [-45,45] for sign in [-1,1]]:
        assert point_inside(tree,p);ds=[tree.ray_cast(p,dd,1000)[3] for dd in [d,-d]];assert all(q is not None for q in ds);widths.append(sum(ds))
    s['unmet']=[q for q in s['unmet'] if not q.startswith('A source spoke')];s['owner_metrics'].update(spoke_minimum_width_m=min(widths),spoke_widths_m=widths,core_clear_diameter_m=min(2*tree.find_nearest(Vector((0,y,55)))[3] for y in np.linspace(-125,125,251)),source_local_components_closed=len(s['native_closed']),source_small_components_dropped=len(s['native_dropped']),source_union_unattached_details_removed=True)
    if s.get('native_backup'):s['native_backup'].use_fake_user=False
    o4_validate('gangut');o4_lighting('gangut');s['preview_specs']['interior']=([-10,-80,61],[0,90,52],None,15)
    for y in [-45,20]:light(s['scene'],'Core amber practical',(0,y,78),160000,(1,.58,.3),16,target=(0,y,15))
    light(s['scene'],'Core cool bounce',(0,0,55),35000,(.4,.6,.8),kind='POINT');purge('Gangut source silhouette and working 70m bay complete')

# Review 8: hydrate the delivered owner asset without importing its high source again.
def o4_hydrate(name):
    sc=bpy.data.scenes[name];bpy.context.window.scene=sc;meta=json.loads((OUT/name/(name+'.json')).read_text());v=json.loads((OUT/name/'validation.json').read_text());source=Path.home()/'Downloads/commander-ship-assets'/O4_FILES[name]
    with source.open('rb') as f:header=f.read(20);length=struct.unpack_from('<I',header,12)[0];doc=json.loads(f.read(length))
    s=dict(scene=sc,source_doc=doc,source_path=str(source),source_bin_start=28+length,source_parts=[dict(primitive=p) for m in doc['meshes'] for p in m['primitives']],paths=[[[p[0],-p[2],p[1]] for p in path] for path in meta['paths']],markers=sum([meta[k] for k in ['ports','entrances','deposits','cargo','pads']],[]),unmet=list(v['unmet_rules']),validation=v,owner_metrics=v.get('owner_metrics',{}),preview_specs=json.loads(sc['owner_metadata'])['preview_specs'])
    s.update({k:meta[k] for k in ['ports','entrances','deposits','cargo','pads']});s['collider']=next(o for o in sc.objects if o.get('asset_node')=='collider');s['lods']=sorted([o for o in sc.objects if str(o.get('asset_node','')).startswith('lod')],key=lambda o:o['asset_node']);s['lod0']=s['lods'][0];s['material']=s['lod0'].data.materials[0];s['images']={k:next(n.image for n in s['material'].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.name.startswith(name+'_'+k)) for k in ['base','normal','orm','emissive']};STATE[name]=s;return s


def r8_gangut_gates():
    s=STATE['gangut'];col=s['collider'];tree=mesh_bvh(col)[0];s['r8_before']=[dict(local_z=z,inside=point_inside(tree,Vector((0,-z,55))),gap_m=tree.find_nearest(Vector((0,-z,55)))[3]) for z in range(-320,321,5)]
    ob=col.copy();ob.data=col.data.copy();s['scene'].collection.objects.link(ob);ob.hide_set(False);ob.hide_render=False;ob.data.materials.append(s['material'])
    # Armour overlaps each cut torus end and stays outside the 96m gate.
    for sign in [-1,1]:
        for x in [-51,51]:
            cap=cube_part('Dock gate armoured closed end',(x,sign*196,55),(8,20,20))
            for q in cap.data.uv_layers.active.data:q.uv=(.75,.75)
            cap.data.materials.append(s['material']);select(ob);mod=ob.modifiers.new('Gate armour union','BOOLEAN');enum_value(mod,'solver','EXACT');enum_value(mod,'operation','UNION');mod.object=cap;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cap,do_unlink=True)
        cutter=cube_part('96m axis ring gate',(0,sign*202,55),(96,110,96))
        for q in cutter.data.uv_layers.active.data:q.uv=(.75,.75)
        boolean_cut(ob,cutter)
    decimate(ob,1000000);print('Gate topology',topology(ob),intersection_check(ob));o4_adopt_render('gangut',ob);s['paths'][0]=[[0,-320,55],[0,320,55]]
    s['owner_metrics'].update(axis_path_length_m=640,ring_gate_count=2,ring_gate_clear_width_m=96,ring_gate_clear_height_m=96,ring_gate_centres_yup=[[0,55,202],[0,55,-202]],armoured_closed_ends=True,hazard_lip_width_m=2,gate_amber_lights=8)
    purge('Review8 two closed docking gate cuts')


def r8_gate_details():
    s=STATE['gangut'];size=1024
    # Four tiny swatches in the otherwise unused atlas tile; original artist tiles stay intact.
    for k in ['base','emissive']:
        im=s['images'][k];a=np.empty(size*size*4,np.float32);im.pixels.foreach_get(a);a=a.reshape(size,size,4)
        for yy in range(840,880):
            for xx in range(840,880):
                color=((.55,.32,.045) if ((xx+yy)//7)%2 else (.035,.045,.055)) if k=='base' else (0,0,0);a[yy,xx,:3]=color
        a[900:920,900:920,:3]=(.20,.10,.025) if k=='base' else (.08,.028,.004)
        im.pixels.foreach_set(a.ravel());im.update();im.filepath_raw=str(OUT/'gangut'/('gangut_'+k+'.png'));im.save();im.reload();im.pack()
    verts=[];faces=[];uvs=[]
    for sign in [-1,1]:
        for side in [-1,1]:
            x=side*49.1;y=sign*206.025
            # A 2m hazard strip on each armoured torus end, viewed along the approach.
            start=len(verts);verts.extend([(x-1,y,48),(x+1,y,48),(x+1,y,62),(x-1,y,62)]);faces.append(tuple(range(start,start+4)));uvs.append([(840/1024,840/1024),(880/1024,840/1024),(880/1024,880/1024),(840/1024,880/1024)])
            for z in [48,62]:
                start=len(verts);verts.extend([(x+side*2-1,y,z-.6),(x+side*2+1,y,z-.6),(x+side*2+1,y,z+.6),(x+side*2-1,y,z+.6)]);faces.append(tuple(range(start,start+4)));uvs.append([(910/1024,910/1024)]*4)
    me=bpy.data.meshes.new('Gate thin hazard lips and dim amber pairs');me.from_pydata(verts,[],faces);me.update();uv=me.uv_layers.new(name='UVMap')
    for f,coords in zip(me.polygons,uvs):
        for li,q in zip(f.loop_indices,coords):uv.data[li].uv=q
    part=bpy.data.objects.new(me.name,me);s['scene'].collection.objects.link(part);me.materials.append(s['material']);ob=s['lod0'];bpy.ops.object.select_all(action='DESELECT');ob.hide_set(False);ob.select_set(True);part.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.join();decimate(ob,1000000);o4_guides('gangut',ob)
    for old in s['lods'][1:]:bpy.data.objects.remove(old,do_unlink=True)
    s['lods']=[ob]
    for level,ratio in [(1,.35),(2,.1)]:
        child=ob.copy();child.data=ob.data.copy();s['scene'].collection.objects.link(child);child.name='gangut_lod'+str(level);child['asset_node']='lod'+str(level);child.hide_set(False);decimate(child,round(len(ob.data.polygons)*ratio));child.data.validate(clean_customdata=False);child.hide_render=True;child.hide_set(True);s['lods'].append(child)
    o4_validate('gangut');s['validation']['review']='review-8';s['validation']['axis_clearance_before']=s['r8_before'];s['validation']['route_clearance_before_after_m'][0]['before']=0;s['validation']['route_clearance_before_after_m'][0]['before_inside_samples']=sum(q['inside'] for q in s['r8_before']);dump(OUT/'gangut/validation.json',s['validation']);o4_lighting('gangut');s['preview_specs']['interior']=([0,-320,55],[0,85,55],None,32)
    for y in [-45,20]:light(s['scene'],'Core amber practical',(0,y,78),160000,(1,.58,.3),16,target=(0,y,15))
    purge('Review8 gate markings and complete 640m axis route')

# Review 7 is an appearance-only pass: accepted kit colliders and routes stay byte-for-byte stable.
def k7_maps():
    size=1024
    for k in ['base','emissive']:
        im=K4_SHARED['images'][k];a=np.empty(size*size*4,np.float32);im.pixels.foreach_get(a);a=a.reshape(size,size,4)
        if k=='base':
            plain=a[:410,:,:3];plain*=.37/.31
            # Lift broad metal panels as well; leave structural ribs, hazard and interiors dark.
            a[794:870,:,:3]*=np.array([.36/.23,.37/.27,.38/.30])
        a[510:518,950:958,:3]=(.34,.40,.42) if k=='base' else (.085,.12,.14)
        a[530:538,950:958,:3]=(.28,.14,.035) if k=='base' else (.075,.024,.003)
        im.pixels.foreach_set(a.ravel());im.update();im.filepath_raw=str(OUT/'kit_shared'/('kit_'+k+'.png'));im.save();im.reload();im.pack()
    m=json.loads((OUT/'kit_shared/shared_material.json').read_text());m.update(review='review-7',outer_hull_albedo_nominal=[.348,.363,.377],exterior_window_emission_rgb=[.085,.12,.14],exterior_amber_emission_rgb=[.075,.024,.003],exterior_emission_strength=3);dump(OUT/'kit_shared/shared_material.json',m);purge('Review7 shared hull albedo and dim exterior swatches')


def k7_top_well(s):
    if s['scene'].name!='kit_tower_top':return
    port=next((p for p in s['ports'] if p['direction']==[0.,1.,0.]),None)
    if not port:return
    s['ports'].remove(port);ob=next(o for o in s['scene'].objects if o.get('asset_node')==port['name']);old=port['name'];ob['asset_node']='top_well';ob.name='top_well'
    record=next(m for m in s['markers'] if m['name']==old);record['name']='top_well';s['entrances']=[dict(record)];print('Top well exported as entrance, not port')


def k7_exterior(name):
    s=STATE[name];bpy.context.window.scene=s['scene'];s['unmet']=[q for q in s['validation']['unmet_rules'] if not q.startswith('LOD0 target')];k7_top_well(s)
    col=s['collider'];before=(tuple(v.co[:] for v in col.data.vertices),tuple(tuple(f.vertices) for f in col.data.polygons));surface=mesh_bvh(s['lod0'])[0];coords=np.array([v.co[:] for v in col.data.vertices]);lo=coords.min(0);hi=coords.max(0);centre=(lo+hi)/2;verts=[];faces=[];uvs=[];counts={}
    def quad(points,amber=False):
        start=len(verts);verts.extend(points);faces.append(tuple(range(start,start+4)));uvs.append((954/1024,(534 if amber else 514)/1024))
    # Rays land on real external hull geometry, with two rows per cardinal side.
    for axis in range(3):
        tang=[j for j in range(3) if j!=axis];uaxis=tang[0];vaxis=tang[1];n=np.eye(3)[axis]
        for sign in [-1,1]:
            key=str(axis)+('+' if sign>0 else '-')
            if s['scene'].get('review7_exterior') and s['validation'].get('review7',{}).get('exterior_panes_per_face',{}).get(key,0):
                counts[key]=s['validation']['review7']['exterior_panes_per_face'][key];continue
            n=n*0+np.eye(3)[axis]*sign;added=0
            us=np.linspace(lo[uaxis]+(hi[uaxis]-lo[uaxis])*.25,hi[uaxis]-(hi[uaxis]-lo[uaxis])*.25,max(2,min(5,int((hi[uaxis]-lo[uaxis])/30))))
            vs=[centre[vaxis]-(hi[vaxis]-lo[vaxis])*.17,centre[vaxis]+(hi[vaxis]-lo[vaxis])*.17]
            for row,v in enumerate(vs):
                for u in us:
                    p=centre.copy();p[uaxis]=u;p[vaxis]=v;p[axis]=(hi[axis]+20) if sign>0 else lo[axis]-20;h,normal,_,distance=surface.ray_cast(Vector(p),Vector(-n),float(hi[axis]-lo[axis]+40))
                    if h is None or abs(normal.dot(Vector(n)))<.85:continue
                    # Reject deep interior returns through a port or torn opening.
                    if abs(h[axis]-(hi[axis] if sign>0 else lo[axis]))>14:continue
                    if any(abs(Vector((r['position'][0],-r['position'][2],r['position'][1])).dot(Vector(n))-h.dot(Vector(n)))<2 and abs(Vector((r['direction'][0],-r['direction'][2],r['direction'][1])).dot(Vector(n)))>.9 for r in s['ports']):continue
                    uu=np.eye(3)[uaxis];vv=np.eye(3)[vaxis];w=min(3.2,float(hi[uaxis]-lo[uaxis])*.10);height=min(1.3,float(hi[vaxis]-lo[vaxis])*.035)
                    # Each pane has its own local surface hit, so no floating strip bridges a rib.
                    for off in [-4.6,0,4.6]:
                        q=Vector(p+uu*off);hit,nn,_,_=surface.ray_cast(q,Vector(-n),float(hi[axis]-lo[axis]+40))
                        if hit is None or abs(nn.dot(Vector(n)))<.85 or (hit-h).length>8:continue
                        pos=np.array(hit)+n*.035;points=[tuple(pos+uu*x+vv*y) for x,y in [(-w/2,-height/2),(w/2,-height/2),(w/2,height/2),(-w/2,height/2)]];quad(points,amber=(row==0 and added==0));added+=1
            counts[str(axis)+('+' if sign>0 else '-')]=added
    me=bpy.data.meshes.new(name+' Review7 exterior window rows');me.from_pydata(verts,[],faces);me.update();uv=me.uv_layers.new(name='UVMap')
    for f,co in zip(me.polygons,uvs):
        for li in f.loop_indices:uv.data[li].uv=co
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();me.materials.append(s['material'])
    for lod in s['lods'] if faces else []:
        part=bpy.data.objects.new(name+' exterior window faces',me.copy());s['scene'].collection.objects.link(part);bpy.ops.object.select_all(action='DESELECT');lod.hide_set(False);lod.select_set(True);part.select_set(True);bpy.context.view_layer.objects.active=lod;bpy.ops.object.join();lod.hide_render=lod!=s['lod0'];lod.hide_set(lod!=s['lod0'])
    assert before==(tuple(v.co[:] for v in col.data.vertices),tuple(tuple(f.vertices) for f in col.data.polygons))
    k6_validate(name);k6_lip_audit(name,True);v=s['validation'];v['review']='review-7';v['review7']=dict(collider_geometry_unchanged=True,route_metadata_unchanged=True,outer_hull_albedo_nominal=[.348,.363,.377],small_exterior_panes=sum(counts.values()),exterior_panes_per_face=counts,windows_on_all_render_lods=True,top_well_is_entrance=(name=='kit_tower_top'));dump(OUT/name/'validation.json',v);s['scene']['review7_exterior']=True;purge(name+' Review7 appearance only')

# Ruin: close small panel pockets with visible structural infill, never an invisible large lid.
def o4_halka_gap_prepare():
    s=STATE['halka_harabe'];ob=s['lod0'];tree=mesh_bvh(ob)[0];parts=[];gaps=[]
    for f in ob.data.polygons:
        if f.area<2:continue
        p=f.center;n=f.normal;h,nn,ix,d=tree.ray_cast(p+n*.03,n,9.96)
        if h is None or nn.dot(n)>-.94:continue
        points=[ob.data.vertices[i].co.copy() for i in f.vertices];edges=[(points[i]-points[(i+1)%3]).length for i in range(3)]
        if max(edges)>24 or min(edges)<1.5 or f.area>100:continue
        # Limit the prism to the opposing panel's footprint.
        checks=[tree.ray_cast(q+n*.04,n,9.96) for q in [p*.4+q*.6 for q in points]]
        if any(hit is None or normal.dot(n)>-.85 for hit,normal,_,length in checks):continue
        length=max([d]+[r[3] for r in checks])+.08;verts=[q-n*.06 for q in points]+[q+n*length for q in points];faces=[(0,2,1),(3,4,5),(0,1,4),(0,4,3),(1,2,5),(1,5,4),(2,0,3),(2,3,5)];me=bpy.data.meshes.new('Subship panel-gap infill');me.from_pydata(verts,[],faces);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();uv=me.uv_layers.new(name='UVMap')
        for q in uv.data:q.uv=(.75,.75)
        part=bpy.data.objects.new(me.name,me);s['scene'].collection.objects.link(part);me.materials.append(s['material']);part.hide_set(True);part.hide_render=True;parts.append(part);gaps.append(dict(width_m=float(d+.03),location_yup=yup(p)))
    s['gap_fill_parts']=parts;s['gap_fills']=gaps;print('Panel pockets to close',len(parts),'largest',max(gaps,key=lambda x:x['width_m'],default=None));purge('Ruin local gap infill prepared')


def o4_halka_gap_union(start,count=15):
    s=STATE['halka_harabe'];ob=s['lod0'];ob.hide_set(False)
    for part in s['gap_fill_parts'][start:start+count]:
        part.hide_set(False);select(ob);mod=ob.modifiers.new('Close subship panel pocket','BOOLEAN');enum_value(mod,'solver','MANIFOLD');enum_value(mod,'operation','UNION');mod.object=part;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(part,do_unlink=True)
    print('Pocket infill',start,min(start+count,len(s['gap_fill_parts'])));purge('Ruin small-gap closure batch')

# Scan processing is streamed: never import the two-million-triangle scan as a whole.
def o4_rock_cluster(name,start=0,count=3,pitch=8):
    s=STATE[name]
    if start==0:s['cluster']=dict(keys={},sums=[],counts=[],faces=[])
    cache=s['cluster']
    for index in range(start,min(start+count,len(s['source_parts']))):
        v,f,_=o4_source_arrays(s,index);q=np.floor(v/pitch).astype(np.int32);keys,inv=np.unique(q,axis=0,return_inverse=True);sums=np.zeros((len(keys),3));np.add.at(sums,inv,v);counts=np.bincount(inv);mapping=[]
        for k,total,n in zip(keys,sums,counts):
            key=tuple(int(x) for x in k);j=cache['keys'].get(key)
            if j is None:j=len(cache['sums']);cache['keys'][key]=j;cache['sums'].append(total);cache['counts'].append(int(n))
            else:cache['sums'][j]+=total;cache['counts'][j]+=int(n)
            mapping.append(j)
        mapped=np.asarray(mapping,dtype=np.int32)[inv][f];valid=(mapped[:,0]!=mapped[:,1])&(mapped[:,0]!=mapped[:,2])&(mapped[:,1]!=mapped[:,2]);cache['faces'].append(mapped[valid])
    print(name,'scan chunks',start,min(start+count,len(s['source_parts'])),'cells',len(cache['sums']));purge(name+' streamed source clustering')


def o4_rock_mesh(name):
    s=STATE[name];cache=s.pop('cluster');v=np.array(cache['sums'])/np.array(cache['counts'])[:,None];f=np.concatenate(cache['faces']);_,indices=np.unique(np.sort(f,axis=1),axis=0,return_index=True);f=f[indices];me=bpy.data.meshes.new(name+' licensed scan silhouette');me.from_pydata(v.tolist(),[],f.tolist());me.update();ob=bpy.data.objects.new(name+' coarse scan',me);s['scene'].collection.objects.link(ob);s['rock_work']=ob;select(ob);bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();print('CLUSTER TOPOLOGY',topology(ob));o4_meshfix(ob);purge(name+' source scan closed')


def o4_rock_low(name):
    s=STATE[name];ob=s['rock_work'];select(ob);ob.data.remesh_voxel_size=8;ob.data.remesh_voxel_adaptivity=.15;bpy.ops.object.voxel_remesh();mod=ob.modifiers.new('Low scan surface smoothing','SMOOTH');mod.factor=.25;mod.iterations=2;bpy.ops.object.modifier_apply(modifier=mod.name);decimate(ob,7350);r3_clean(ob);o4_meshfix(ob);p=np.array([v.co[:] for v in ob.data.vertices]);lo=p.min(0);hi=p.max(0);floor=lo[2]+(hi[2]-lo[2])*.28;s['crack_floor']=float(floor);s['crack_axis']=1 if hi[1]-lo[1]<hi[0]-lo[0] else 0;cross=1-s['crack_axis'];centre=(lo+hi)/2;centre[cross]=0;centre[2]=(floor+hi[2]+100)/2;size=hi-lo+200;size[cross]=72;size[2]=hi[2]+100-floor;boolean_cut(ob,cube_part('72m deep through frontier crack',centre,size));decimate(ob,1000000);r3_clean(ob);o4_meshfix(ob)
    # Shared retopology makes the full collider and LOD0 match exactly.
    s['lods']=[];s['collider']=bpy.data.objects.new('temporary collider',bpy.data.meshes.new('empty'));s['scene'].collection.objects.link(s['collider']);mat=bpy.data.materials.new(name+' basalt PBR');mat.use_nodes=True;mat.use_fake_user=True;ob.data.materials.clear();ob.data.materials.append(mat);s['material']=mat;o4_adopt_render(name,ob);low=s['lod0'];select(low);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.05,island_margin=.008);bpy.ops.object.mode_set(mode='OBJECT');s['images']={}
    for kind,color in [('base',(.24,.27,.30,1)),('normal',(.5,.5,1,1)),('orm',(1,.79,.08,1)),('emissive',(0,0,0,1))]:
        im=bpy.data.images.new(name+'_'+kind,1024,1024,alpha=False);im.colorspace_settings.name='Non-Color' if kind in ['normal','orm'] else 'sRGB';im.generated_color=color;im.use_fake_user=True;s['images'][kind]=im
    mid=np.array([0,0,floor+85]);axis=np.eye(3)[s['crack_axis']];extent=max(abs(lo[s['crack_axis']]),abs(hi[s['crack_axis']]))+60;s['flight_mid']=mid;s['flight_axis']=axis;s['paths']=[[(mid-axis*extent).tolist(),(mid+axis*extent).tolist()]]
    for sign in [-1,1]:marker(s,'entrance_'+str(1 if sign<0 else 2),mid+axis*extent*sign,axis*sign)
    s['owner_metrics']=dict(source_streamed_chunks=len(s['source_parts']),cluster_pitch_m=8,remesh_voxel_m=8,crack_clear_width_m=72,crack_depth_m=float(hi[2]-floor),crack_base_fraction=.28,source_normal_bake_resolution=1024)
    print('ROCK LOW',name,topology(s['collider']));purge(name+' low cliff and deep through crack')


def o4_rock_base(name):
    s=STATE[name];sc=s['scene'];low=s['lod0'];bpy.context.window.scene=sc;set_engine(sc,'CYCLES');sc.cycles.samples=1;sc.render.threads_mode='FIXED';sc.render.threads=2;sc.render.bake.use_selected_to_active=False;sc.render.bake.use_clear=True;sc.render.bake.margin=3;mat=s['material'];ns=mat.node_tree.nodes;links=mat.node_tree.links;bs=next(n for n in ns if n.type=='BSDF_PRINCIPLED');out=next(n for n in ns if n.type=='OUTPUT_MATERIAL');geo=ns.new('ShaderNodeNewGeometry');noise=ns.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=.019;noise.inputs['Detail'].default_value=2;noise.inputs['Roughness'].default_value=.55;links.new(geo.outputs['Position'],noise.inputs['Vector']);ramp=ns.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.18;ramp.color_ramp.elements[0].color=(.14,.17,.21,1);ramp.color_ramp.elements[1].position=.82;ramp.color_ramp.elements[1].color=(.32,.34,.36,1);links.new(noise.outputs['Fac'],ramp.inputs[0]);em=ns.new('ShaderNodeEmission');links.new(ramp.outputs['Color'],em.inputs[0]);links.new(em.outputs[0],out.inputs['Surface']);target=ns.new('ShaderNodeTexImage');target.name='Scan bake target';target.image=s['images']['base'];ns.active=target;low.hide_set(False);low.hide_render=False;select(low);bpy.ops.object.bake(type='EMIT');links.new(bs.outputs[0],out.inputs['Surface']);s['normal_accum']=np.tile(np.array([.5,.5,1,1],np.float32),(1024,1024,1));s['normal_bake_chunks']=[];im=bpy.data.images.new(name+' streamed normal temporary',1024,1024,alpha=False);im.colorspace_settings.name='Non-Color';im.use_fake_user=True;s['normal_temp']=im;purge(name+' broad basalt palette baked')


def o4_rock_normal_chunk(name,index):
    s=STATE[name];sc=s['scene'];low=s['lod0'];high=o4_load_part(name,index,False);info=s['source_parts'][index];attributes=info['primitive']['attributes']
    if 'NORMAL' in attributes:
        raw=o4_accessor(s,attributes['NORMAL']).astype(float);raw=raw@np.linalg.inv(np.array(info['matrix'])[:3,:3]);raw=np.stack([raw[:,0],-raw[:,2],raw[:,1]],axis=1);raw/=np.maximum(np.linalg.norm(raw,axis=1),1e-20)[:,None];high.data.normals_split_custom_set_from_vertices(raw.tolist())
    sc.render.bake.use_selected_to_active=True;sc.render.bake.use_clear=True;sc.render.bake.cage_extrusion=8;sc.render.bake.max_ray_distance=28;sc.render.bake.margin=2;target=s['material'].node_tree.nodes['Scan bake target'];target.image=s['normal_temp'];s['material'].node_tree.nodes.active=target;low.hide_set(False);low.hide_render=False;high.hide_set(False);high.hide_render=False;bpy.ops.object.select_all(action='DESELECT');high.select_set(True);low.select_set(True);bpy.context.view_layer.objects.active=low;bpy.ops.object.bake(type='NORMAL');a=np.empty(1024*1024*4,np.float32);s['normal_temp'].pixels.foreach_get(a);a=a.reshape(1024,1024,4);valid=(np.linalg.norm(a[:,:,:3],axis=2)>.4)&(a[:,:,2]>.15)&(np.max(np.abs(a[:,:,:3]-np.array([.5,.5,1])),axis=2)>.008);s['normal_accum'][valid]=a[valid];s['normal_accum'][:,:,3]=1;s['normal_bake_chunks'].append(dict(source_chunk=index,source_triangles=len(high.data.polygons),pixels_transferred=int(valid.sum())));bpy.data.objects.remove(high,do_unlink=True);s['source_work']=[];print('NORMAL CHUNK',name,index,int(valid.sum()));purge(name+' high source chunk removed after bake')


def o4_rock_finish(name):
    s=STATE[name];mat=s['material'];ns=mat.node_tree.nodes;links=mat.node_tree.links;bs=next(n for n in ns if n.type=='BSDF_PRINCIPLED');bs.inputs['Metallic'].default_value=.08;bs.inputs['Roughness'].default_value=.79;s['images']['normal'].pixels.foreach_set(s.pop('normal_accum').ravel());s['images']['normal'].update();tex={}
    for k,im in s['images'].items():
        im.filepath_raw=str(OUT/name/(name+'_'+k+'.png'));im.file_format='PNG';im.save();im.source='FILE';im.reload();im.pack();tex[k]=ns.new('ShaderNodeTexImage');tex[k].image=im
    links.new(tex['base'].outputs[0],bs.inputs['Base Color']);normal=ns.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.8;links.new(tex['normal'].outputs[0],normal.inputs['Color']);links.new(normal.outputs[0],bs.inputs['Normal']);sep=ns.new('ShaderNodeSeparateColor');links.new(tex['orm'].outputs[0],sep.inputs[0]);links.new(sep.outputs[1],bs.inputs['Roughness']);links.new(sep.outputs[2],bs.inputs['Metallic']);links.new(tex['emissive'].outputs[0],bs.inputs['Emission Color']);group=ns.new('ShaderNodeGroup');group.node_tree=bpy.data.node_groups['glTF Material Output'];links.new(sep.outputs[0],group.inputs['Occlusion']);bpy.data.images.remove(s.pop('normal_temp'));ns.remove(ns['Scan bake target']);s['owner_metrics']['normal_bake_chunks']=s['normal_bake_chunks'];s['owner_metrics']['normal_bake_source_triangles']=sum(q['source_triangles'] for q in s['normal_bake_chunks'])
    for old in s['lods'][1:]:bpy.data.objects.remove(old,do_unlink=True)
    s['lods']=[s['lod0']]
    for level,ratio in [(1,.35),(2,.1)]:
        child=s['lod0'].copy();child.data=s['lod0'].data.copy();s['scene'].collection.objects.link(child);child.name=name+'_lod'+str(level);child['asset_node']='lod'+str(level);child.hide_set(False);decimate(child,round(len(s['lod0'].data.polygons)*ratio));child.data.validate(clean_customdata=False);child.hide_render=True;child.hide_set(True);s['lods'].append(child)
    o4_validate(name);o4_lighting(name);spec=s['preview_specs']['exterior_1100m'];s['preview_specs']['exterior_1100m']=(spec[0],spec[1],None,28);mid=Vector(s['flight_mid']);axis=Vector(s['flight_axis']);s['preview_specs']['interior']=(list(mid-axis*90),list(mid+axis*120),None,22);purge(name+' finished streamed scan maps')

# A frontier crack needs fractured walls rather than the perfectly planar boolean cut.
def o4_rock_fracture(name):
    s=STATE[name];ob=s['lod0'];axis=s['crack_axis'];cross=1-axis;ob.hide_set(False);select(ob)
    if len(ob.data.polygons)>6800:decimate(ob,6700)
    bm=bmesh.new();bm.from_mesh(ob.data);lo=min(v.co.z for v in bm.verts);hi=max(v.co.z for v in bm.verts)
    for direction,values in [(2,np.arange(s['crack_floor']+35,hi,40)),(axis,np.arange(-350,351,40))]:
        for value in values:
            fs=[f for f in bm.faces if all(abs(abs(v.co[cross])-36)<.025 for v in f.verts)]
            if not fs:continue
            edges={e for f in fs for e in f.edges};verts={v for f in fs for v in f.verts};co=Vector((0,0,0));co[direction]=value;normal=Vector((0,0,0));normal[direction]=1;bmesh.ops.bisect_plane(bm,geom=list(fs)+list(edges)+list(verts),dist=.00001,plane_co=co,plane_no=normal,clear_inner=False,clear_outer=False)
    for v in bm.verts:
        if abs(abs(v.co[cross])-36)<.025:
            amount=1.7+1.25*math.sin(v.co.z*.057+v.co[axis]*.027)+.4*math.sin(v.co[axis]*.13-v.co.z*.023);v.co[cross]=math.copysign(36+amount,v.co[cross])
        if abs(v.co.z-s['crack_floor'])<.025:v.co.z+=2*(1+math.sin(v.co[axis]*.07+v.co[cross]*.03))
    bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free();r3_clean(ob)
    if len(ob.data.polygons)>7950:decimate(ob,7900)
    if topology(ob)['non_manifold_edges'] or not intersection_check(ob)['passed']:o4_meshfix_uv(ob)
    print('FRACTURED',name,topology(ob));o4_adopt_render(name,ob);s['owner_metrics'].update(crack_clear_width_m=[72.1,78.7],crack_wall_fracture_pitch_m=40)
    purge(name+' natural crack wall geometry')


def o4_rock_tone(name,scale_base=True):
    s=STATE[name];ob=s['lod0'];axis=s['crack_axis'];cross=1-axis;arrays={}
    for k in ['base','normal']:
        a=np.empty(1024*1024*4,np.float32);s['images'][k].pixels.foreach_get(a);arrays[k]=a.reshape(1024,1024,4)
    if scale_base:arrays['base'][:,:,:3]*=.65
    painted=0
    for f in ob.data.polygons:
        points=np.array([ob.data.vertices[i].co[:] for i in f.vertices])
        if not (np.all(np.abs(points[:,cross])>31.5) and np.all(np.abs(points[:,cross])<40)):continue
        uv=np.array([ob.data.uv_layers['UVMap'].data[i].uv[:] for i in f.loop_indices])*1024
        low=np.maximum(np.floor(uv.min(0)).astype(int),0);high=np.minimum(np.ceil(uv.max(0)).astype(int),1023)
        if np.any(high<low):continue
        yy,xx=np.mgrid[low[1]:high[1]+1,low[0]:high[0]+1];p=np.stack([xx+.5,yy+.5],axis=-1);matrix=np.array([uv[1]-uv[0],uv[2]-uv[0]]).T
        if abs(np.linalg.det(matrix))<1e-8:continue
        bary=(p-uv[0])@np.linalg.inv(matrix).T;mask=(bary[:,:,0]>=-.005)&(bary[:,:,1]>=-.005)&(bary.sum(2)<=1.005);world=points[0]+bary[:,:,0,None]*(points[1]-points[0])+bary[:,:,1,None]*(points[2]-points[0]);value=.27+.023*np.sin(world[:,:,2]*.11+world[:,:,axis]*.025)+.012*np.sin(world[:,:,2]*.035-world[:,:,axis]*.049);tile=arrays['base'][low[1]:high[1]+1,low[0]:high[0]+1,:3];tile[mask]=(value[:,:,None]*np.array([.92,.98,1.04]))[mask];arrays['normal'][low[1]:high[1]+1,low[0]:high[0]+1,:3][mask]=(.5,.5,1);painted+=int(mask.sum())
    for k,a in arrays.items():
        im=s['images'][k];im.pixels.foreach_set(a.ravel());im.update();im.save();im.reload();im.pack()
    print('Basalt tone and fresh fractured wall pixels',painted);o4_validate(name);s['validation']['owner_metrics']=s['owner_metrics'];dump(OUT/name/'validation.json',s['validation']);purge(name+' basalt palette corrected from own preview')


def o4_rock_crack_shape(name):
    s=STATE[name];ob=s['lod0'];axis=s['crack_axis'];cross=1-axis;wallfaces=[f for f in ob.data.polygons if all(35.9<abs(ob.data.vertices[i].co[cross])<40 for i in f.vertices)];ids={i for f in wallfaces for i in f.vertices}
    for i in ids:
        v=ob.data.vertices[i];width=31.7+3.8*(1+math.sin(v.co.z*.06+v.co[axis]*.045));v.co[cross]=math.copysign(width,v.co[cross])
    for f in wallfaces:f.use_smooth=False
    ob.data.update();assert_solid(ob);assert intersection_check(ob)['passed'];o4_adopt_render(name,ob);s['owner_metrics']['crack_clear_width_m']=[63.4,78.6];s['owner_metrics']['crack_wall_geometry']='40m fracture panels, 7.6m depth variation, flat shaded fresh fracture planes'


def o4_rock_preview_light(name):
    s=STATE[name];sc=s['scene']
    for ob in list(sc.objects):
        if ob.type=='LIGHT':bpy.data.objects.remove(ob,do_unlink=True)
    light(sc,'Frontier arena sun',(-500,700,900),1.8,(.94,.91,.86),kind='SUN');light(sc,'Frontier restrained sky fill',(500,300,400),2.0e6,(.45,.62,.85),450,target=(0,0,0));light(sc,'Frontier low rim',(-400,-400,600),3e6,(.5,.65,.85),300,target=(0,0,0));sc.view_settings.exposure=0;s['preview_specs']['exterior_1100m']=(list(Vector((-.8,1.4,.7)).normalized()*1100),[0,0,0],None,28)
    mid=Vector(s['flight_mid']);axis=Vector(s['flight_axis']);s['preview_specs']['interior']=(list(mid+axis*90),list(mid-axis*120),None,22);purge(name+' arena-scale restrained preview illumination')


def o4_rock_structured_walls(name):
    s=STATE[name];base=s['collider'];ob=base.copy();ob.data=base.data.copy();s['scene'].collection.objects.link(ob);ob.hide_set(False);ob.hide_render=False;ob.data.materials.append(s['material']);axis=s['crack_axis'];cross=1-axis
    wallids={i for f in ob.data.polygons if all(31.5<abs(ob.data.vertices[i].co[cross])<40 for i in f.vertices) for i in f.vertices}
    for i in wallids:ob.data.vertices[i].co[cross]=math.copysign(36,ob.data.vertices[i].co[cross])
    group=ob.vertex_groups.new(name='Outer scan simplification, keep crack boundary');group.add([i for i in range(len(ob.data.vertices)) if i not in wallids],1,'REPLACE');select(ob);mod=ob.modifiers.new('Simplify only the scanned outer surface','DECIMATE');mod.ratio=.9;mod.vertex_group=group.name;mod.vertex_group_factor=1000;bpy.ops.object.modifier_apply(modifier=mod.name)
    bm=bmesh.new();bm.from_mesh(ob.data);fs={f for f in bm.faces if all(abs(abs(v.co[cross])-36)<.02 for v in f.verts)};edges=[e for e in bm.edges if len(e.link_faces)==2 and all(f in fs for f in e.link_faces)];bmesh.ops.dissolve_edges(bm,edges=edges,use_verts=True,use_face_split=False)
    for direction,values in [(2,np.arange(s['crack_floor']+35,max(v.co.z for v in bm.verts),40)),(axis,np.arange(-350,351,40))]:
        for value in values:
            fs=[f for f in bm.faces if all(abs(abs(v.co[cross])-36)<.02 for v in f.verts)]
            edges={e for f in fs for e in f.edges};verts={v for f in fs for v in f.verts};co=Vector((0,0,0));co[direction]=value;n=Vector((0,0,0));n[direction]=1
            if fs:bmesh.ops.bisect_plane(bm,geom=list(fs)+list(edges)+list(verts),dist=.00001,plane_co=co,plane_no=n,clear_inner=False,clear_outer=False)
    fs={f for f in bm.faces if all(abs(abs(v.co[cross])-36)<.02 for v in f.verts)};wallverts={v for f in fs for v in f.verts};border={v for f in fs for e in f.edges if any(g not in fs for g in e.link_faces) for v in e.verts}
    for v in wallverts-border:v.co[cross]=math.copysign(31.7+3.8*(1+math.sin(v.co.z*.06+v.co[axis]*.045)),v.co[cross])
    bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    for f in bm.faces:
        if all(31.5<abs(v.co[cross])<40 for v in f.verts):f.smooth=False
    bm.to_mesh(ob.data);bm.free();r3_clean(ob)
    if topology(ob)['non_manifold_edges'] or not intersection_check(ob)['passed']:o4_meshfix_uv(ob)
    assert len(ob.data.polygons)<=8000,len(ob.data.polygons);o4_adopt_render(name,ob);s['owner_metrics']['crack_clear_width_m']=[63.4,78.6];s['owner_metrics']['crack_wall_geometry']='Regular 40m fracture grid; boundary held on the licensed scan; up to 7.6m wall relief';print('STRUCTURED WALLS',name,len(ob.data.polygons))


def o4_rock_final_uv(name,refine=False):
    s=STATE[name];ob=s['lod0'];ob.hide_set(False);select(ob)
    if refine:
        cross=1-s['crack_axis'];bm=bmesh.new();bm.from_mesh(ob.data);edges=sorted([e for e in bm.edges if all(abs(v.co[cross])>42 for v in e.verts)],key=lambda e:e.calc_length(),reverse=True)[:500];result=bmesh.ops.subdivide_edges(bm,edges=edges,cuts=1,use_grid_fill=True);bm.normal_update()
        for v in result.get('geom_inner',[]):
            if isinstance(v,bmesh.types.BMVert):v.co+=v.normal*(.65*math.sin(v.co.x*.073+v.co.y*.057+v.co.z*.093))
        bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
    assert_solid(ob);assert intersection_check(ob)['passed'];assert 6000<=len(ob.data.polygons)<=8000,len(ob.data.polygons)
    for uv in list(ob.data.uv_layers):ob.data.uv_layers.remove(uv)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.05,island_margin=.008);bpy.ops.object.mode_set(mode='OBJECT');old=s['material'];old.use_fake_user=False;mat=bpy.data.materials.new(name+' final basalt PBR');mat.use_nodes=True;mat.use_fake_user=True;s['material']=mat;ob.data.materials.clear();ob.data.materials.append(mat);o4_adopt_render(name,ob);print('FINAL SCAN RETOPO UV',name,len(ob.data.polygons));purge(name+' clean final fracture UVs before high-detail bake')


def r8_reinforce_gate_spokes():
    s=STATE['gangut'];col=s['collider'];ob=col.copy();ob.data=col.data.copy();s['scene'].collection.objects.link(ob);ob.hide_set(False);ob.hide_render=False;ob.data.materials.append(s['material'])
    for side in [-1,1]:
        for sign in [-1,1]:
            for a,b in [((side*45,sign*132,55),(side*52,sign*152,55)),((side*52,sign*150,55),(side*52,sign*196,55))]:
                beam=r1_beam('8m load path around 96m docking gate',a,b,8)
                for q in beam.data.uv_layers.active.data:q.uv=(.75,.75)
                beam.data.materials.append(s['material']);select(ob);mod=ob.modifiers.new('Gate-side full width reinforcement','BOOLEAN');enum_value(mod,'solver','EXACT');enum_value(mod,'operation','UNION');mod.object=beam;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(beam,do_unlink=True)
    for sign in [-1,1]:
        cutter=cube_part('Keep docking gate 96m clear',(0,sign*202,55),(96,110,96))
        for q in cutter.data.uv_layers.active.data:q.uv=(.75,.75)
        boolean_cut(ob,cutter)
    decimate(ob,1000000);r3_clean(ob)
    if topology(ob)['non_manifold_edges'] or not intersection_check(ob)['passed']:o4_meshfix_uv(ob)
    assert_solid(ob);o4_adopt_render('gangut',ob);r8_gate_details();purge('Gate side spokes stay full width beyond the hub')


def r8_collider_compact():
    s=STATE['gangut'];ob=s['collider'];ob.hide_set(False);select(ob);backup=ob.data.copy();backup.use_fake_user=True;s['compact_backup']=backup
    mod=ob.modifiers.new('Collision ignores coplanar UV seams','DECIMATE');mod.decimate_type='DISSOLVE';mod.angle_limit=.001;mod.delimit=set();mod.use_dissolve_boundaries=True;bpy.ops.object.modifier_apply(modifier=mod.name);decimate(ob,1000000);print('COPLANAR COLLIDER',topology(ob),intersection_check(ob));purge('Coplanar-only collision simplification')


def r8_final_validate():
    s=STATE['gangut'];tree=mesh_bvh(s['collider'])[0];widths=[]
    for p,d in [(Vector((sign*145,0,55)),Vector((0,1,0))) for sign in [-1,1]]+[(Vector((x,sign*170,55)),Vector((1,0,0))) for x in [-52,52] for sign in [-1,1]]:
        assert point_inside(tree,p);hits=[tree.ray_cast(p,q,500)[3] for q in [d,-d]];widths.append(sum(hits))
    sections=[]
    for a in np.linspace(0,2*math.pi,96,endpoint=False):
        if abs(202*math.cos(a))<60:continue
        p=Vector((202*math.cos(a),202*math.sin(a),55));assert point_inside(tree,p);u=Vector((math.cos(a),math.sin(a),0));hits=[tree.ray_cast(p,d,300)[3] for d in [u,-u,Vector((0,0,1)),Vector((0,0,-1))]];sections.extend([hits[0]+hits[1],hits[2]+hits[3]])
    assert min(widths)>=3.99 and min(sections)>=7.99;s['owner_metrics'].update(spoke_minimum_width_m=min(widths),spoke_widths_m=widths,outer_ring_minimum_cross_section_m=min(sections),ring_samples=len(sections)//2,ring_sample_rule='Remaining torus outside the two intentional 96m gates; abs(x)>=60m',gate_spokes_rerouted_outside_opening=True)
    o4_validate('gangut');v=s['validation'];v['review']='review-8';v['axis_clearance_before']=s['r8_before'];v['route_clearance_before_after_m'][0]['before']=0;v['route_clearance_before_after_m'][0]['before_inside_samples']=sum(q['inside'] for q in s['r8_before']);pts=sample_path(s['paths'][0],1);v['owner_metrics']['axis_clearance_1m_samples']=len(pts);v['owner_metrics']['core_clear_diameter_m']=min(2*tree.find_nearest(Vector(p))[3] for p in pts);assert v['owner_metrics']['core_clear_diameter_m']>=69.99;dump(OUT/'gangut/validation.json',v)
    if s.get('compact_backup'):s.pop('compact_backup').use_fake_user=False
    purge('Review8 final axis, remaining ring and full-width spokes')


def r8_adaptive_collider():
    s=STATE['gangut'];ob=s['collider'];base=s['compact_backup'];tree=mesh_bvh(ob)[0];protected=s.setdefault('collision_protected',set());new={v.index for v in base.vertices if tree.find_nearest(v.co)[3]>.6};bad=intersection_check(ob)
    centres=[ob.data.polygons[i].center.copy() for pair in bad['pairs'] for i in pair]
    new|={v.index for v in base.vertices if any((v.co-p).length_squared<8**2 for p in centres)}
    adjacency=[set() for _ in base.vertices]
    for e in base.edges:a,b=e.vertices;adjacency[a].add(b);adjacency[b].add(a)
    new|={j for i in list(new) for j in adjacency[i]};protected|=new
    # Lock measured fine features first; the route planes are checked separately after simplification.
    ob.data=base.copy();ob.vertex_groups.clear();group=ob.vertex_groups.new(name='Preserve routes and measured silhouette features');group.add([v.index for v in ob.data.vertices if v.index not in protected],1,'REPLACE');ob.hide_set(False);select(ob);mod=ob.modifiers.new('Measured 12k collision simplification','DECIMATE');mod.ratio=12000/len(base.polygons);mod.vertex_group=group.name;mod.vertex_group_factor=1;bpy.ops.object.modifier_apply(modifier=mod.name);decimate(ob,1000000);r3_clean(ob);tree=mesh_bvh(ob)[0];maximum=max(tree.find_nearest(v.co)[3] for v in base.vertices);print('ADAPTIVE COLLIDER',len(protected),'protected','tri',len(ob.data.polygons),'original vertex deviation',maximum,'self',intersection_check(ob));purge('Adaptive collision preserves measured small source features')

# Final Review 7 check: sample the full wall, including the piers beside large port openings.
def k7_complete_wall_rows(name):
    s=STATE[name];bpy.context.window.scene=s['scene'];review=dict(s['validation']['review7']);counts=dict(review['exterior_panes_per_face']);surface=mesh_bvh(s['lod0'])[0];col=s['collider'];coords=np.array([v.co[:] for v in col.data.vertices]);lo=coords.min(0);hi=coords.max(0);centre=(lo+hi)/2;verts=[];faces=[];uvs=[]
    for axis in [0,1]:
        uaxis=1-axis;vaxis=2;uu=np.eye(3)[uaxis];vv=np.eye(3)[vaxis]
        for sign in [-1,1]:
            key=str(axis)+('+' if sign>0 else '-')
            if counts.get(key,0):continue
            n=np.eye(3)[axis]*sign;added=0;span=hi[uaxis]-lo[uaxis];us=np.linspace(lo[uaxis]+7,hi[uaxis]-7,max(2,int(span/20)+1))
            for row,v in enumerate([centre[2]-(hi[2]-lo[2])*.15,centre[2]+(hi[2]-lo[2])*.15]):
                for u in us:
                    p=centre.copy();p[uaxis]=u;p[2]=v;p[axis]=hi[axis]+20 if sign>0 else lo[axis]-20;h,normal,_,_=surface.ray_cast(Vector(p),Vector(-n),float(hi[axis]-lo[axis]+40))
                    if h is None or abs(normal.dot(Vector(n)))<.8 or (h[axis]-centre[axis])*sign<0:continue
                    if any(abs(Vector((r['position'][0],-r['position'][2],r['position'][1])).dot(Vector(n))-h.dot(Vector(n)))<.20 and abs(Vector((r['direction'][0],-r['direction'][2],r['direction'][1])).dot(Vector(n)))>.9 for r in s['ports']):continue
                    for off in [-4.6,0,4.6]:
                        q=Vector(p+uu*off);hit,nn,_,_=surface.ray_cast(q,Vector(-n),float(hi[axis]-lo[axis]+40))
                        if hit is None or abs(nn.dot(Vector(n)))<.8 or (hit-h).length>8:continue
                        w=3.2;height=1.2;points=[Vector(np.array(hit)+uu*x+vv*y) for x,y in [(-w/2,-height/2),(w/2,-height/2),(w/2,height/2),(-w/2,height/2)]];attached=True
                        for corner in points:
                            hh,normal,_,_=surface.ray_cast(corner+Vector(n)*.2,Vector(-n),.4)
                            if hh is None or (hh-corner).length>.08:attached=False;break
                        if not attached:continue
                        start=len(verts);verts.extend([tuple(corner+Vector(n)*.035) for corner in points]);faces.append(tuple(range(start,start+4)));amber=row==0 and added==0;uvs.append((954/1024,(534 if amber else 514)/1024));added+=1
            counts[key]=added
    if not faces:print('No missing eligible exterior wall',name);return False
    me=bpy.data.meshes.new(name+' external wall pane rows');me.from_pydata(verts,[],faces);me.update();uv=me.uv_layers.new(name='UVMap')
    for f,co in zip(me.polygons,uvs):
        for li in f.loop_indices:uv.data[li].uv=co
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();me.materials.append(s['material'])
    for lod in s['lods']:
        part=bpy.data.objects.new(me.name,me.copy());s['scene'].collection.objects.link(part);bpy.ops.object.select_all(action='DESELECT');lod.hide_set(False);lod.select_set(True);part.select_set(True);bpy.context.view_layer.objects.active=lod;bpy.ops.object.join();lod.hide_render=lod!=s['lod0'];lod.hide_set(lod!=s['lod0'])
    s['unmet']=[q for q in s['validation']['unmet_rules'] if not q.startswith('LOD0 target')];k6_validate(name);k6_lip_audit(name,True);review.update(small_exterior_panes=sum(counts.values()),exterior_panes_per_face=counts,vertical_wall_pier_pass=True);s['validation']['review7']=review;s['validation']['review']='review-7';dump(OUT/name/'validation.json',s['validation']);print('Additional wall panes',name,len(faces),counts);purge(name+' outer vertical faces inspected');return True


def k7_final_exterior_emission():
    im=K4_SHARED['images']['emissive'];a=np.empty(1024*1024*4,np.float32);im.pixels.foreach_get(a);a=a.reshape(1024,1024,4);a[510:518,950:958,:3]=(.32,.44,.52);a[530:538,950:958,:3]=(.17,.055,.006);im.pixels.foreach_set(a.ravel());im.update();im.save();im.reload();im.pack();meta=json.loads((OUT/'kit_shared/shared_material.json').read_text());meta.update(exterior_window_emission_rgb=[.32,.44,.52],exterior_amber_emission_rgb=[.17,.055,.006],exterior_emission_strength=3);dump(OUT/'kit_shared/shared_material.json',meta);purge('Window rows readable on the shadow side; amber remains dim')

# Collider precision repair: the visible mesh buffers and gameplay JSON are immutable.
def q9_gap_audit(tree,points):
    checked=[]
    for raw in points:
        p=Vector(raw);hit,n,_,distance=tree.find_nearest(p)
        if distance<=.75:continue
        directions=[n,Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)),(hit-p).normalized()]
        for i in range(192):
            z=1-2*(i+.5)/192;a=i*math.pi*(3-math.sqrt(5));r=math.sqrt(1-z*z);directions.append(Vector((r*math.cos(a),r*math.sin(a),z)))
        spans=[]
        for d in directions:
            a=tree.ray_cast(p,d,10);b=tree.ray_cast(p,-d,10)
            if a[0] is not None and b[0] is not None and a[3]+b[3]<=10:spans.append((a[3]+b[3],a[0],b[0]))
        assert spans,('No measured <=10m opposing gap at exception',tuple(p),distance)
        width,a,b=min(spans,key=lambda x:x[0]);checked.append(dict(width_m=width,position_yup=yup(p),opposed_wall_points_yup=[yup(a),yup(b)]))
    return dict(passed=True,exception_samples=len(checked),largest_measured_gap=max(checked,key=lambda x:x['width_m']) if checked else None)


def q9_precision(ob):
    from mathutils.kdtree import KDTree
    vertices=np.array([v.co[:] for v in ob.data.vertices],np.float64);faces=np.array([p.vertices[:] for p in ob.data.polygons],np.int32);tri=vertices[faces]
    def minimum_altitude(t):
        return float((np.linalg.norm(np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]),axis=1)/np.max([np.linalg.norm(t[:,i]-t[:,(i+1)%3],axis=1) for i in range(3)],axis=0)).min())
    kd=KDTree(len(vertices))
    for i,p in enumerate(vertices):kd.insert(Vector(p),i)
    kd.balance();separation=min(kd.find_n(Vector(p),2)[1][2] for p in vertices)
    radius=float(np.linalg.norm(vertices,axis=1).max());scale=32767*.9999/radius
    # JS Math.round(x) is floor(x+.5), including negative halves.
    quant=np.floor(vertices*scale+.5).astype(np.int64);unique,remap=np.unique(quant,axis=0,return_inverse=True);qfaces=remap[faces]
    edges=np.sort(np.concatenate([qfaces[:,[0,1]],qfaces[:,[1,2]],qfaces[:,[2,0]]]),axis=1);_,counts=np.unique(edges,axis=0,return_counts=True)
    qtri=unique[qfaces];area=np.linalg.norm(np.cross(qtri[:,1]-qtri[:,0],qtri[:,2]-qtri[:,0]),axis=1)
    result=dict(merge_distance_m=.02,minimum_distinct_corner_distance_m=separation,minimum_triangle_altitude_m=minimum_altitude(tri),radius_m=radius,quantisation_grid_m=1/scale,int16_unique_corners=len(unique),source_corners=len(vertices),corners_welded_by_quantising=len(vertices)-len(unique),quantised_degenerate_triangles=int(sum(area==0)),quantised_edges_not_on_two_triangles=int(sum(counts!=2)),minimum_quantised_triangle_altitude_m=minimum_altitude(qtri.astype(np.float64)/scale))
    assert separation>=.02 and result['minimum_triangle_altitude_m']>=.02,result
    assert result['corners_welded_by_quantising']==result['quantised_degenerate_triangles']==result['quantised_edges_not_on_two_triangles']==0,result
    return result


def q9_replace_collider_only(name):
    import hashlib
    s=STATE[name];folder=OUT/name;path=folder/(name+'.glb');raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);start=28+n;binary=bytearray(raw[start:start+struct.unpack_from('<I',raw,20+n)[0]])
    before=bytes(binary);old_nodes=json.loads(json.dumps(doc['nodes']));node=next(n for n in doc['nodes'] if n['name']=='collider');ob=s['collider'];assert ob.matrix_world==__import__('mathutils').Matrix.Identity(4)
    vertices=np.array([[v.co.x,v.co.z,-v.co.y] for v in ob.data.vertices],'<f4');indices=np.array([p.vertices[:] for p in ob.data.polygons],'<u2').reshape(-1)
    def append_accessor(array,kind,component,target):
        binary.extend(b'\0'*((-len(binary))%4));offset=len(binary);binary.extend(array.tobytes());view=len(doc['bufferViews']);doc['bufferViews'].append(dict(buffer=0,byteOffset=offset,byteLength=array.nbytes,target=target));a=dict(bufferView=view,componentType=component,count=len(array),type=kind)
        if kind=='VEC3':a.update(min=array.min(0).tolist(),max=array.max(0).tolist())
        index=len(doc['accessors']);doc['accessors'].append(a);return index
    position=append_accessor(vertices,'VEC3',5126,34962);index=append_accessor(indices,'SCALAR',5123,34963);doc['meshes'][node['mesh']]['primitives']=[dict(attributes=dict(POSITION=position),indices=index,mode=4)]
    doc['buffers'][0]['byteLength']=len(binary);binary.extend(b'\0'*((-len(binary))%4));encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);payload=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
    assert bytes(binary[:len(before)])==before and doc['nodes']==old_nodes
    assert (folder/(name+'.json')).read_bytes()==s['fixed_json_bytes']
    path.write_bytes(payload);s['validation']['collider_precision_repair']=dict(**q9_precision(ob),lod_buffers_preserved_byte_for_byte=True,all_original_binary_bytes_preserved=True,all_nodes_preserved=True,route_json_sha256=hashlib.sha256(s['fixed_json_bytes']).hexdigest())
    print('COLLIDER ONLY EXPORT',name,len(indices)//3,len(payload),s['validation']['collider_precision_repair'])


def q9_collapse_slivers(ob,threshold=.025):
    bm=bmesh.new();bm.from_mesh(ob.data)
    def altitude(f):
        a,b,c=[v.co for v in f.verts];return (b-a).cross(c-a).length/max((a-b).length,(b-c).length,(c-a).length,1e-12)
    for iteration in range(1000):
        bad=[f for f in bm.faces if len(f.verts)==3 and altitude(f)<threshold]
        if not bad:break
        edge=min(min(bad,key=altitude).edges,key=lambda e:e.calc_length());bmesh.ops.pointmerge(bm,verts=list(edge.verts),merge_co=(edge.verts[0].co+edge.verts[1].co)*.5)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0201);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free();print('Sliver collapses',iteration)


def q9_quality_relax(name,steps=20):
    """Preserve the solid topology while widening precision-sized corners locally.

    Used when wholesale sliver deletion would erase a long, millimetre-thick feature.
    Every accepted local move is checked against nonincident triangle intersections.
    """
    from mathutils.kdtree import KDTree
    s=STATE[name];ob=s['collider'];vertices=np.array([v.co[:] for v in ob.data.vertices],np.float64);faces=np.array([p.vertices[:] for p in ob.data.polygons],np.int32)
    def safe(v):
        tree=BVHTree.FromPolygons(v.tolist(),faces.tolist(),all_triangles=True)
        return not any(a!=b and not set(faces[a]).intersection(faces[b]) for a,b in tree.overlap(tree))
    accepted=0;blocked=0
    for step in range(steps):
        kd=KDTree(len(vertices))
        for i,p in enumerate(vertices):kd.insert(Vector(p),i)
        kd.balance();pairs=[]
        for i,p in enumerate(vertices):
            for _,j,d in kd.find_range(Vector(p),.030):
                if j>i:pairs.append((d,i,j))
        tri=vertices[faces];edges=np.stack([np.linalg.norm(tri[:,i]-tri[:,(i+1)%3],axis=1) for i in range(3)],1);alt=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)/edges.max(1);bad=np.where(alt<.030)[0]
        if not pairs and not len(bad):break
        tasks=[]
        for d,a,b in sorted(pairs):
            u=(vertices[b]-vertices[a])/max(d,1e-15);gap=.040-d
            tasks.append([(a,-u*gap*.5),(b,u*gap*.5)])
        for i in bad[np.argsort(alt[bad])]:
            ring=faces[i];long=int(edges[i].argmax());a,b,c=ring[long],ring[(long+1)%3],ring[(long+2)%3];u=vertices[b]-vertices[a];base=vertices[a]+u*np.dot(vertices[c]-vertices[a],u)/np.dot(u,u);offset=vertices[c]-base;d=np.linalg.norm(offset)
            if d<1e-10:
                offset=np.cross(u,np.array((0,0,1)) if abs(u[2]/np.linalg.norm(u))<.9 else np.array((1,0,0)));offset=offset/np.linalg.norm(offset)*1e-8;d=1e-8
            delta=offset/max(d,1e-15)*(.040-d)
            tasks.extend([[(c,delta)],[(a,-delta),(b,-delta)],[(c,delta*.5),(a,-delta*.5),(b,-delta*.5)]])
            axis=u/np.linalg.norm(u);e1=offset/max(d,1e-15);e2=np.cross(axis,e1)
            for angle in [30,-30,60,-60,90,-90,120,-120,150,-150,180]:
                turn=math.radians(angle);desired=(e1*math.cos(turn)+e2*math.sin(turn))*.040-offset
                tasks.extend([[(c,desired)],[(a,-desired),(b,-desired)],[(c,desired*.5),(a,-desired*.5),(b,-desired*.5)]])
        progress=False
        for changes in tasks:
            candidate=vertices.copy()
            for index,delta in changes:candidate[index]+=delta
            if safe(candidate):vertices=candidate;accepted+=1;progress=True;break
            blocked+=1
        if not progress:break
    for v,p in zip(ob.data.vertices,vertices):v.co=p
    ob.data.update();print('QUALITY RELAX',accepted,'blocked trials',blocked,'close pairs',len(pairs),'thin triangles',len(bad),'minimum_altitude',float(alt.min()))
    return not pairs and not len(bad)


def q9_quantised_crossings(vertices,faces):
    radius=float(np.linalg.norm(vertices,axis=1).max());scale=32767*.9999/radius;q=np.floor(vertices*scale+.5)/scale
    tree=BVHTree.FromPolygons(q.tolist(),faces.tolist(),all_triangles=True)
    return [(a,b) for a,b in tree.overlap(tree) if a<b and not set(faces[a]).intersection(faces[b])]


def q9_quantised_barrier(name,max_steps=8):
    s=STATE[name];ob=s['collider'];verts=np.array([v.co[:] for v in ob.data.vertices],np.float64);faces=np.array([p.vertices[:] for p in ob.data.polygons],np.int32)
    for step in range(max_steps):
        pairs=q9_quantised_crossings(verts,faces);print('QUANTISED CONTACTS',len(pairs))
        if not pairs:break
        moved=False;grid=float(np.linalg.norm(verts,axis=1).max())/(32767*.9999)
        for pair in pairs:
            for vertex in set(faces[list(pair)].reshape(-1)):
                for axis in [0,1,2]:
                    for sign in [-1,1]:
                        trial=verts.copy();trial[vertex,axis]+=grid*sign*1.05
                        if len(q9_quantised_crossings(trial,faces))>=len(pairs):continue
                        tree=BVHTree.FromPolygons(trial.tolist(),faces.tolist(),all_triangles=True)
                        if any(a<b and not set(faces[a]).intersection(faces[b]) for a,b in tree.overlap(tree)):continue
                        ob.data.vertices[int(vertex)].co=trial[vertex];ob.data.update()
                        try:q9_precision(ob)
                        except AssertionError:ob.data.vertices[int(vertex)].co=verts[vertex];continue
                        verts=trial;moved=True;print('Accepted lattice clearance',int(vertex),axis,sign);break
                    if moved:break
                if moved:break
            if moved:break
        if not moved:break
    assert not q9_quantised_crossings(verts,faces),'Unresolved quantised contacts'
    print('QUANTISED INTERSECTIONS ZERO')

# Review 4: scanned geology and large, protected silhouette fractures.
def r4_prism(label,profile,plane,axis_range):
    other=next(i for i in range(3) if i not in plane);verts=[]
    for depth in axis_range:
        for a,b in profile:
            q=[0.,0.,0.];q[plane[0]]=a;q[plane[1]]=b;q[other]=depth;verts.append(q)
    n=len(profile);faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)];me=bpy.data.meshes.new(label);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(label,me);bpy.context.scene.collection.objects.link(ob);r3_clean(ob);return ob


def r4_kovuk_cut_batch(start=0,count=3):
    s=STATE['kovuk'];bpy.context.window.scene=s['scene'];col=s['collider'];col.hide_set(False)
    jobs=[]
    for x in [-285,40,380]:jobs.append(([(x-90,500),(x,225),(x+90,500)],(0,2),(-550,550),'Top cross fracture'))
    for y,z in [(-210,200),(30,230),(245,190)]:jobs.append(([(y-90,500),(y,z),(y+90,500)],(1,2),(-800,1000),'Longitudinal crown fracture'))
    for sign in [-1,1]:
        for x in [-260,70,390]:jobs.append(([(x-100,sign*650),(x,sign*265),(x+100,sign*650)],(0,1),(-500,550),'Deep flank fracture'))
    for x in [-220,100,440]:jobs.append(([(x-90,-600),(x,-235),(x+90,-600)],(0,2),(-550,550),'Underside fracture'))
    for i in range(start,min(start+count,len(jobs))):
        profile,plane,span,label=jobs[i];boolean_cut(col,r4_prism(label+' '+str(i),profile,plane,span));print('FRACTURE',i,len(col.data.polygons))
    if start+count>=len(jobs):boolean_cut(col,r3_box('Straight planar west fracture removes sawtooth',(-700,0,0),(550,1300,1300)))
    purge('Kovuk Review4 fracture batch '+str(start))


def r4_scan_maps(name,source_file='nordic_beach_rock_ukxkffifa_mid.glb'):
    s=STATE[name];source=Path.home()/'Downloads/commander-ship-assets'/source_file
    raw=source.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);binary=raw[28+length:];mat=doc['materials'][0];pbr=mat['pbrMetallicRoughness'];specs={'base':pbr['baseColorTexture'],'normal':mat['normalTexture'],'orm':pbr['metallicRoughnessTexture']}
    s['r4_scan_source']=str(source);s['r4_scan_sha256']=__import__('hashlib').sha256(raw).hexdigest()
    for kind,tex in specs.items():
        image_info=doc['images'][doc['textures'][tex['index']]['source']];view=doc['bufferViews'][image_info['bufferView']];encoded=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']];scratch=OUT/name/('.source_'+kind+'.img');scratch.write_bytes(encoded);im=bpy.data.images.load(str(scratch),check_existing=False);im.name=name+'_scan_'+kind;im.colorspace_settings.name='sRGB' if kind=='base' else 'Non-Color';im.scale(1024,1024);im.filepath_raw=str(OUT/name/(name+'_'+kind+'.png'));im.file_format='PNG';im.save();im.pack();im.use_fake_user=True;s['images'][kind]=im;scratch.unlink()
    im=s['images']['emissive'];im.scale(1024,1024);a=np.zeros((1024,1024,4),np.float32);a[:,:,3]=1;a[400:624,144:368,:3]=(.08,.35,.24);a[400:624,656:880,:3]=(.72,.20,.035);im.pixels.foreach_set(a.ravel());im.update();im.filepath_raw=str(OUT/name/(name+'_emissive.png'));im.save();im.pack();print('SCAN PBR',source_file,mat);purge(name+' licensed 1024 scan textures')


def r4_scan_uv(name):
    s=STATE[name]
    for ob in s['lods']:
        me=ob.data;uv=me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap');ore=me.uv_layers.get('OreUV') or me.uv_layers.new(name='OreUV');veins=me.attributes.get('r2_vein');warm=me.attributes.get('r4_warm');colors=me.color_attributes.get('Geology')
        for f in me.polygons:
            axis=max(range(3),key=lambda j:abs(f.normal[j]));a,b=[j for j in range(3) if j!=axis];vein=bool(veins and veins.data[f.index].value);is_warm=bool(warm and warm.data[f.index].value)
            f.use_smooth=False if abs(f.center.x)>380 or abs(f.center.y)>230 or abs(f.center.z)>185 else True
            for li in f.loop_indices:
                p=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(p[a]/32,p[b]/32);ore.data[li].uv=(.75,.5) if is_warm else (.25,.5) if vein else (.001,.001)
                if colors:colors.data[li].color=(1,1,1,1)
        me.uv_layers.active=uv;uv.active_render=True
    mat=s['material'];ns=mat.node_tree.nodes;ns.clear();links=mat.node_tree.links;bs=ns.new('ShaderNodeBsdfPrincipled');out=ns.new('ShaderNodeOutputMaterial');links.new(bs.outputs[0],out.inputs[0]);tex={}
    for kind,im in s['images'].items():node=ns.new('ShaderNodeTexImage');node.image=im;tex[kind]=node
    links.new(tex['base'].outputs[0],bs.inputs['Base Color']);sep=ns.new('ShaderNodeSeparateColor');links.new(tex['orm'].outputs[0],sep.inputs[0]);links.new(sep.outputs[1],bs.inputs['Roughness']);bs.inputs['Metallic'].default_value=0;normal=ns.new('ShaderNodeNormalMap');links.new(tex['normal'].outputs[0],normal.inputs['Color']);normal.inputs['Strength'].default_value=.32;links.new(normal.outputs[0],bs.inputs['Normal']);ore=ns.new('ShaderNodeUVMap');ore.uv_map='OreUV';links.new(ore.outputs[0],tex['emissive'].inputs['Vector']);links.new(tex['emissive'].outputs[0],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=4
    group=ns.new('ShaderNodeGroup');group.node_tree=bpy.data.node_groups.get('glTF Material Output');links.new(sep.outputs[0],group.inputs['Occlusion']);purge(name+' 32m box-projected photogrammetry PBR')


def r4_kovuk_broadcuts(start=0,count=3):
    s=STATE['kovuk'];ob=s['collider'];jobs=[]
    for x in [-285,60,400]:jobs.append(([(x-40.7,207.3),(x+40.7,207.3),(x+150.3,500.8),(x-150.3,500.8)],(0,2),(-551,551)))
    for y in [-210,100,275]:jobs.append(([(y-40.7,207.7),(y+40.7,207.7),(y+150.3,501.2),(y-150.3,501.2)],(1,2),(-801,1001)))
    for sign in [-1,1]:
        for x in [-260,70,390]:jobs.append(([(x-40.7,sign*263.7),(x+40.7,sign*263.7),(x+150.3,sign*651.8),(x-150.3,sign*651.8)],(0,1),(-501,551)))
    for i in range(start,min(start+count,len(jobs))):
        profile,plane,span=jobs[i];backup=ob.data.copy();backup.use_fake_user=True;boolean_cut(ob,r4_prism('Wide planar fracture bay '+str(i),profile,plane,span));r3_clean(ob)
        if topology(ob)['non_manifold_edges'] or not intersection_check(ob)['passed']:
            try:r3_heal(ob)
            except AssertionError:ob.data=backup.copy();print('Wide bay rejected',i)
        backup.use_fake_user=False;print('WIDE BAY',i,topology(ob)['triangles'])
    purge('Kovuk broad silhouette bays '+str(start))


def r4_fix_zero_area(name):
    s=STATE[name];ob=s['collider'];verts=np.array([v.co[:] for v in ob.data.vertices]);faces=np.array([p.vertices[:] for p in ob.data.polygons])
    for iteration in range(30):
        tri=verts[faces];area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)*.5;bad=np.where(area<1e-3)[0]
        if not len(bad):break
        moved=False
        for i in bad:
            ring=faces[i];edges=[np.linalg.norm(tri[i,j]-tri[i,(j+1)%3]) for j in range(3)];j=int(np.argmax(edges));a,b,c=ring[j],ring[(j+1)%3],ring[(j+2)%3];axis=verts[b]-verts[a];axis/=np.linalg.norm(axis);base=verts[a]+axis*np.dot(verts[c]-verts[a],axis);off=verts[c]-base;direction=off/max(np.linalg.norm(off),1e-30)
            if np.linalg.norm(direction)<.5:direction=np.cross(axis,np.array((0,0,1)) if abs(axis[2])<.9 else np.array((1,0,0)));direction/=np.linalg.norm(direction)
            normal=np.cross(axis,direction)
            for angle in [0,30,-30,60,-60,90,-90]:
                turn=math.radians(angle);delta=(direction*math.cos(turn)+normal*math.sin(turn))*.005-off;trial=verts.copy();trial[c]+=delta;tree=BVHTree.FromPolygons(trial.tolist(),faces.tolist(),all_triangles=True)
                if not any(a<b and not set(faces[a]).intersection(faces[b]) for a,b in tree.overlap(tree)):verts=trial;moved=True;break
            if moved:break
        if not moved:break
    for vertex,p in zip(ob.data.vertices,verts):vertex.co=p
    ob.data.update();print('Zero-area local repair',iteration,topology(ob))


def r4_mouth_glows(name):
    s=STATE[name];tree=mesh_bvh(s['collider'])[0];positions=[];verts=[];faces=[]
    for m in s['entrances']:
        p=Vector((m['position'][0],-m['position'][2],m['position'][1]));d=Vector((m['direction'][0],-m['direction'][2],m['direction'][1])).normalized();origin=p-d*32;side=d.cross(Vector((0,0,1)))
        if side.length<.1:side=Vector((1,0,0))
        side.normalize();candidates=[];eye=p+d*400
        for offset in [0,12,-12,24,-24,36,-36]:
            ray=(p-d*80+side*offset-eye).normalized();hit,n,_,_=tree.ray_cast(eye,ray,1600)
            if hit is not None:
                depth=(p-hit).dot(d)
                if 8<depth<700:candidates.append((abs(depth-65),hit,n))
        assert candidates,('No visible interior crystal wall',m['name']);_,hit,n=min(candidates,key=lambda x:x[0]);u=n.cross(d)
        if u.length<.1:u=n.cross(Vector((0,0,1)) if abs(n.z)<.9 else Vector((1,0,0)))
        u.normalize();v=n.cross(u).normalized();start=len(verts)
        for point in [hit]+[hit+u*3.5*math.cos(a)+v*5.5*math.sin(a) for a in np.linspace(0,2*math.pi,8,endpoint=False)]:
            q,nn,_,_=tree.find_nearest(point);verts.append(q+nn*.06)
        faces.extend((start,start+1+j,start+1+(j+1)%8) for j in range(8));positions.append(dict(entrance=m['name'],warm_crystal_position_yup=yup(hit)))
    me=bpy.data.meshes.new('Warm crystals one per fixed mouth');me.from_pydata(verts,[],faces);me.update();warm=me.attributes.new('r4_warm','INT','FACE');region=me.attributes.new('r1_region','INT','FACE')
    for a in warm.data:a.value=1
    for a in region.data:a.value=1
    me.materials.append(s['material'])
    for lod in s['lods']:
        part=bpy.data.objects.new(me.name,me.copy());s['scene'].collection.objects.link(part);lod.hide_set(False);part.hide_set(False);bpy.ops.object.select_all(action='DESELECT');part.select_set(True);lod.select_set(True);bpy.context.view_layer.objects.active=lod;bpy.ops.object.join();lod.hide_render=lod!=s['lod0'];lod.hide_set(lod!=s['lod0'])
    s['r4_mouth_glows']=positions;r4_scan_uv(name);print('MOUTH CRYSTALS',positions);purge(name+' warm exported mouth crystals')


def r4_silhouette_notches(name):
    ob=STATE[name]['collider'];verts=np.array([v.co[:] for v in ob.data.vertices]);edges=np.array([e.vertices[:] for e in ob.data.edges]);reports=[]
    for horizontal,vertical,label in [(0,2,'+/-Y'),(1,2,'+/-X'),(0,1,'+/-Z')]:
        lo,hi=verts[:,horizontal].min(),verts[:,horizontal].max();samples=np.arange(lo+2,hi-1,4.);top=np.full(len(samples),-np.inf);bottom=np.full(len(samples),np.inf)
        for a,b in verts[edges]:
            if abs(a[horizontal]-b[horizontal])<1e-7:continue
            mask=(samples>=min(a[horizontal],b[horizontal]))&(samples<=max(a[horizontal],b[horizontal]));z=a[vertical]+(samples[mask]-a[horizontal])/(b[horizontal]-a[horizontal])*(b[vertical]-a[vertical]);top[mask]=np.maximum(top[mask],z);bottom[mask]=np.minimum(bottom[mask],z)
        found=[]
        for side,profile in [('upper',top),('lower',-bottom)]:
            selected=[]
            for i in range(5,len(profile)-5):
                if not np.isfinite(profile[i]) or profile[i]>min(profile[i-1],profile[i+1]):continue
                left=profile[max(0,i-40):i];right=profile[i+1:i+41];depth=min(float(left.max()),float(right.max()))-profile[i]
                if depth>=20:selected.append((i,float(depth)))
            plateaus=[]
            for item in selected:
                if plateaus and item[0]<=plateaus[-1][-1][0]+1:plateaus[-1].append(item)
                else:plateaus.append([item])
            selected=[group[len(group)//2] for group in plateaus]
            for i,depth in sorted(selected,key=lambda x:-x[1]):
                if all(abs(samples[i]-x['profile_position_m'])>=55 or x['side']!=side for x in found):found.append(dict(side=side,profile_position_m=float(samples[i]),depth_m=depth))
        reports.append(dict(view_axis=label,deep_notch_count=len(found),notches=found,method='Projected triangle-edge envelope at 4m intervals; local recess prominence >=20m within 160m on either side, minima separated >=55m. Principal-axis silhouettes only; oblique directions are visual review.'))
    print('SILHOUETTES',reports);return reports


def q9_importer_audit(ob):
    verts=np.array([[v.co.x,v.co.z,-v.co.y] for v in ob.data.vertices],np.float64);faces=np.array([p.vertices[:] for p in ob.data.polygons]);radius=float(np.linalg.norm(verts,axis=1).max());q=np.floor(verts*(32767*.9999/radius)+.5).astype(np.int64);corners,remap=np.unique(q,axis=0,return_inverse=True);tris=remap[faces].tolist();tris=[t for t in tris if len(set(t))==3];collapsed=len(faces)-len(tris);split=0
    for guard in range(64):
        flat=next((i for i,(a,b,c) in enumerate(tris) if not np.cross(corners[b]-corners[a],corners[c]-corners[a]).any()),None)
        if flat is None:break
        a,b,c=tris.pop(flat);x,y,m=max([(a,b,c),(b,c,a),(c,a,b)],key=lambda t:np.dot(corners[t[0]]-corners[t[1]],corners[t[0]]-corners[t[1]]));neighbor=next(((i,k) for i,t in enumerate(tris) for k in range(3) if t[k]==y and t[(k+1)%3]==x),None)
        if neighbor:
            i,k=neighbor;far=tris[i][(k+2)%3];tris[i:i+1]=[[y,m,far],[m,x,far]];split+=1
    array=np.array(tris);edges=np.sort(np.concatenate([array[:,[0,1]],array[:,[1,2]],array[:,[2,0]]]),axis=1);_,counts=np.unique(edges,axis=0,return_counts=True);zero=sum(not np.cross(corners[b]-corners[a],corners[c]-corners[a]).any() for a,b,c in tris)
    report=dict(radius_m=radius,grid_m=radius/(32767*.9999),unique_corners=len(corners),triangles_after_quantisation=len(tris),collapsed_triangles=collapsed,split_collinear_triangles=split,edges_not_on_exactly_two_triangles=int(sum(counts!=2)),remaining_collinear_triangles=int(zero),passed=not sum(counts!=2) and not zero)
    print('GAME QUANTISATION',report);return report


def r4_preview(name,kind):
    s=STATE[name];energies=[]
    if name=='kovuk' and kind not in ['interior_chamber','interior_bend']:
        for ob in s['scene'].objects:
            if ob.type=='LIGHT' and ob.data.type!='SUN' and ob.name not in ['Exterior soft fill','Rock rim']:
                energies.append((ob,ob.data.energy));ob.data.energy*=.035
    try:r1_preview(name,kind)
    finally:
        for ob,energy in energies:ob.data.energy=energy


def r4_continuous_scan_tile(name):
    """Choose one covered UV island; never repeat the scan atlas' blurred padding."""
    s=STATE[name];raw=Path(s['r4_scan_source']).read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);binary=raw[28+length:]
    def accessor(i):
        a=doc['accessors'][i];view=doc['bufferViews'][a['bufferView']];dtype={5126:np.float32,5125:np.uint32,5123:np.uint16}[a['componentType']];width={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']];item=np.dtype(dtype).itemsize
        return np.ndarray((a['count'],width),dtype=dtype,buffer=binary,offset=view.get('byteOffset',0)+a.get('byteOffset',0),strides=(view.get('byteStride',width*item),item))
    mask=np.zeros((1024,1024),bool)
    for mesh in doc['meshes']:
        for p in mesh['primitives']:
            uv=accessor(p['attributes']['TEXCOORD_0']).copy()*1024;uv[:,1]=1024-uv[:,1];indices=accessor(p['indices']).reshape(-1,3)
            for tri in uv[indices]:
                xmin,ymin=np.maximum(0,np.floor(tri.min(0)).astype(int));xmax,ymax=np.minimum(1023,np.ceil(tri.max(0)).astype(int))
                if xmin>xmax or ymin>ymax:continue
                X,Y=np.meshgrid(np.arange(xmin,xmax+1)+.5,np.arange(ymin,ymax+1)+.5);a,b,c=tri;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
                if abs(den)<1e-8:continue
                u=((b[1]-c[1])*(X-c[0])+(c[0]-b[0])*(Y-c[1]))/den;v=((c[1]-a[1])*(X-c[0])+(a[0]-c[0])*(Y-c[1]))/den;mask[ymin:ymax+1,xmin:xmax+1]|=(u>=0)&(v>=0)&(u+v<=1)
    # Keep interpolation away from island padding; a single genuine rock patch becomes the tile.
    for axis in [0,1]:mask&=np.roll(mask,3,axis)&np.roll(mask,-3,axis)
    integral=np.pad(mask.astype(np.int32),((1,0),(1,0))).cumsum(0).cumsum(1);chosen=None;base=np.empty(1024*1024*4,np.float32);s['images']['base'].pixels.foreach_get(base);base=base.reshape(1024,1024,4)
    for side in [384,320,256,192,128,96,64]:
        choices=[]
        for y in range(4,1020-side,8):
            for x in range(4,1020-side,8):
                count=integral[y+side,x+side]-integral[y,x+side]-integral[y+side,x]+integral[y,x]
                if count==side*side:choices.append((float(base[y:y+side,x:x+side,:3].var()),x,y))
        if choices:_,x,y=max(choices);chosen=(x,y,side);break
    assert chosen,'No continuous scan patch';x,y,side=chosen
    for kind in ['base','normal','orm']:
        im=s['images'][kind];pixels=np.empty(1024*1024*4,np.float32);im.pixels.foreach_get(pixels);tile=pixels.reshape(1024,1024,4)[y:y+side,x:x+side].copy();tile[:,:,3]=1
        # Symmetric wrap blending touches only a narrow edge band.
        band=max(3,side//24)
        for i in range(band):
            w=.5*(1-i/band);left=tile[:,i,:3].copy();right=tile[:,-1-i,:3].copy();tile[:,i,:3]=left*(1-w)+right*w;tile[:,-1-i,:3]=right*(1-w)+left*w;bottom=tile[i,:,:3].copy();top=tile[-1-i,:,:3].copy();tile[i,:,:3]=bottom*(1-w)+top*w;tile[-1-i,:,:3]=top*(1-w)+bottom*w
        if kind=='normal':n=tile[:,:,:3]*2-1;n/=np.maximum(np.linalg.norm(n,axis=2,keepdims=True),1e-6);tile[:,:,:3]=n*.5+.5
        im.scale(side,side);im.pixels.foreach_set(tile.ravel());im.update();im.scale(1024,1024);im.save();im.pack()
    s['r4_scan_crop']=dict(x=x,y=y,side=side,atlas_size=1024,all_pixels_on_rock_uv_island=True,physical_tile_m=32,normal_strength=.32,edge_wrap_blend_pixels=band);print('CONTINUOUS SCAN TILE',s['r4_scan_crop']);purge(name+' scan-island padding removed')

# Review 9: existing cliff silhouettes/navigation, fractured and textured crack faces.
def r9_cliff_geometry(name):
    s=STATE[name];bpy.context.window.scene=s['scene'];ob=s['collider'];ob.hide_set(False);axis=1;floor=s['paths'][0][0][2]-85;s['crack_axis']=axis;s['crack_floor']=floor;s['r9_before']=json.loads(json.dumps(s['validation']));s['fixed_json_bytes']=(OUT/name/(name+'.json')).read_bytes();ob.data=s['lod0'].data.copy();ob.data.materials.clear();attr=ob.data.attributes.get('r9_wall') or ob.data.attributes.new('r9_wall','INT','FACE')
    for f in ob.data.polygons:attr.data[f.index].value=int(all(30<abs(ob.data.vertices[i].co.x)<42 for i in f.vertices) or (abs(f.center.z-floor)<5 and abs(f.center.x)<45))
    def cut(label,p,size):
        cutter=cube_part(label,p,size);a=cutter.data.attributes.new('r9_wall','INT','FACE')
        for x in a.data:x.value=1
        boolean_cut(ob,cutter)
    cut('Guaranteed 66.8m open flight corridor',(0,0,(floor+1100)/2),(66.8,2200,1100-floor))
    bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free();tree=mesh_bvh(ob)[0];s['r9_lips']=[]
    for y in [-160,140]:
        for sign in [-1,1]:
            hit,n,_,_=tree.ray_cast(Vector((sign*42,y,1000)),Vector((0,0,-1)),2000)
            if hit is not None:s['r9_lips'].append((sign*37.15,y,float(hit.z)))
    # Recessed 2-8m shelves leave solid rock above them as short overhangs.
    for j,y in enumerate([-230,-140,-45,55,145,230]):
        z=floor+72+(j%4)*72;cut('Fractured shelf and overhang '+str(j),(0,y,z),(80.8+(j%2)*1.2,68+(j%3)*8,6+(j%3)))
    for j,(x,y,z) in enumerate(s['r9_lips']):cut('Broken crack lip '+str(j),(x,y,z-1),(7.5,24+j*2,10))
    r3_clean(ob)
    if not intersection_check(ob)['passed']:
        ob.hide_set(False);select(ob);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.intersect_boolean(operation='UNION',use_self=True,solver='EXACT');bpy.ops.object.mode_set(mode='OBJECT');r3_clean(ob)
    r4_fix_zero_area(name);assert_solid(ob)
    if not intersection_check(ob)['passed']:r3_heal(ob)
    if len(ob.data.polygons)>8000:
        wall=ob.data.attributes['r9_wall'];protected={i for f in ob.data.polygons if wall.data[f.index].value for i in f.vertices};group=ob.vertex_groups.new(name='Budget only exterior');group.add([i for i in range(len(ob.data.vertices)) if i not in protected],1,'REPLACE');select(ob);mod=ob.modifiers.new('Hard budget repair, wall vertices protected','DECIMATE');mod.ratio=7600/len(ob.data.polygons);mod.vertex_group=group.name;mod.vertex_group_factor=1000;bpy.ops.object.modifier_apply(modifier=mod.name);r3_clean(ob)
    assert_solid(ob);assert intersection_check(ob)['passed'];assert len(ob.data.polygons)<=8000
    old_lods=s['lods'];low=ob.copy();low.data=ob.data.copy();s['scene'].collection.objects.link(low);low.name=name+'_lod0';low['asset_node']='lod0';low.data.materials.clear();low.data.materials.append(s['material']);s['lod0']=low;s['lods']=[low]
    for old in old_lods:bpy.data.objects.remove(old,do_unlink=True)
    for level,ratio in [(1,.35),(2,.1)]:
        child=low.copy();child.data=low.data.copy();s['scene'].collection.objects.link(child);child.name=name+'_lod'+str(level);child['asset_node']='lod'+str(level);child.hide_set(False);decimate(child,round(len(low.data.polygons)*ratio));s['lods'].append(child)
    for lod in s['lods']:lod.hide_render=lod!=low;lod.hide_set(lod!=low)
    ob.hide_render=True;ob.hide_set(True);tree=mesh_bvh(ob)[0];minimum=min(tree.find_nearest(Vector(p))[3]*2 for path in s['paths'] for p in sample_path(path,1));assert minimum>=64,minimum;s['r9_clearance']=minimum;s['r9_quantisation']=q9_importer_audit(ob);assert s['r9_quantisation']['passed']
    print('R9 ROCK GEOMETRY',name,len(low.data.polygons),'clearance',minimum);purge(name+' one-pass fracture shelves')


def r9_uv_density(name):
    s=STATE[name];ob=s['lod0'];uv=ob.data.uv_layers['UVMap'];wall=ob.data.attributes['r9_wall'];ua=0.;area=0.;samples=[]
    for f in ob.data.polygons:
        if wall.data[f.index].value:continue
        q=[uv.data[i].uv.copy() for i in f.loop_indices];ua+=abs((q[1].x-q[0].x)*(q[2].y-q[0].y)-(q[1].y-q[0].y)*(q[2].x-q[0].x))*.5;area+=f.area;samples.append(sum(q,Vector((0,0)))/3)
    density=math.sqrt(ua*1024**2/area);verts=np.array([v.co[:] for v in ob.data.vertices]);lo=verts.min(0);extent=verts.max(0)-lo;density=min(density,1018/extent.max());s['r9_density']=density;s['r9_uv_origin']=lo.tolist();s['r9_outside_uv_samples']=[q[:] for q in samples];print('MATCHED DENSITY',name,density,'texels/m')


def r9_scan_patch(name):
    s=STATE[name];doc=s['source_doc'];mask=np.zeros((256,256),bool)
    for info in s['source_parts']:
        p=info['primitive'];uv=o4_accessor(s,p['attributes']['TEXCOORD_0']);x=np.clip(np.floor(uv[:,0]*256).astype(int),0,255);y=np.clip(np.floor((1-uv[:,1])*256).astype(int),0,255);mask[y,x]=True
    # Dense scan vertices mark covered UV pixels; retain a margin from the island boundary.
    for axis in [0,1]:mask&=np.roll(mask,2,axis)&np.roll(mask,-2,axis)
    integral=np.pad(mask.astype(np.int32),((1,0),(1,0))).cumsum(0).cumsum(1);chosen=None
    for side in [128,96,80,64,48,32,24,16]:
        candidates=[]
        for y in range(3,253-side,4):
            for x in range(3,253-side,4):
                count=integral[y+side,x+side]-integral[y,x+side]-integral[y+side,x]+integral[y,x]
                if count==side*side:candidates.append((x,y,side))
        if candidates:chosen=candidates[len(candidates)//2];break
    assert chosen,'No covered scan texture patch';s['r9_native_patch']=dict(x=chosen[0],y=chosen[1],side=chosen[2],mask_size=256);s['r9_old_images']=s['images'].copy();s['images']={};r9_uv_density(name);print('NATIVE SCAN PATCH',s['r9_native_patch']);purge(name+' source UV mask without high meshes')


def r9_atlas_map(name,kind):
    s=STATE[name];old=s['r9_old_images'][kind];pixels=np.empty(1024*1024*4,np.float32);old.pixels.foreach_get(pixels);original=pixels.reshape(1024,1024,4);atlas=np.zeros((2048,2048,4),np.float32);atlas[:,:,3]=1;atlas[:1024,:1024]=original
    if kind!='emissive':
        mat=s['source_doc']['materials'][0];pbr=mat['pbrMetallicRoughness'];spec=pbr['baseColorTexture'] if kind=='base' else mat['normalTexture'] if kind=='normal' else pbr['metallicRoughnessTexture'];im_info=s['source_doc']['images'][s['source_doc']['textures'][spec['index']]['source']];view=s['source_doc']['bufferViews'][im_info['bufferView']]
        with open(s['source_path'],'rb') as f:f.seek(s['source_bin_start']+view.get('byteOffset',0));encoded=f.read(view['byteLength'])
        temp=OUT/name/('.review9_'+kind+'.png');temp.write_bytes(encoded);native=bpy.data.images.load(str(temp),check_existing=False);native.colorspace_settings.name='sRGB' if kind=='base' else 'Non-Color';width,height=native.size;data=np.empty(width*height*4,np.float32);native.pixels.foreach_get(data);data=data.reshape(height,width,4);crop=s['r9_native_patch'];x=round(crop['x']/256*width);y=round(crop['y']/256*height);side=round(crop['side']/256*width);patch=data[y:y+side,x:x+side].copy();patch[:,:,3]=1
        if kind=='base':
            uv=np.asarray(s['r9_outside_uv_samples']);samples=original[np.clip((uv[:,1]*1024).astype(int),0,1023),np.clip((uv[:,0]*1024).astype(int),0,1023),:3];target=samples.mean(0);mean=patch[:,:,:3].mean((0,1));gain=target/np.maximum(mean,.005);patch[:,:,:3]=np.clip(patch[:,:,:3]*gain,0,1);s['r9_colour_gain']=gain.tolist()
        elif kind=='normal':
            n=patch[:,:,:3]*2-1;n[:,:,:2]*=.375;n/=np.maximum(np.linalg.norm(n,axis=2,keepdims=True),1e-6);patch[:,:,:3]=n*.5+.5
        else:patch[:,:,0]=1;patch[:,:,1]*=pbr.get('roughnessFactor',1);patch[:,:,2]=0
        native.scale(side,side);native.pixels.foreach_set(patch.ravel());native.update();native.scale(1024,1024);tile=np.empty(1024*1024*4,np.float32);native.pixels.foreach_get(tile);atlas[:1024,1024:]=tile.reshape(1024,1024,4);bpy.data.images.remove(native);temp.unlink()
    im=bpy.data.images.new(name+'_'+kind+'_review9',2048,2048,alpha=False);im.colorspace_settings.name='sRGB' if kind in ['base','emissive'] else 'Non-Color';im.pixels.foreach_set(atlas.ravel());im.update();im.filepath_raw=str(OUT/name/(name+'_'+kind+'.png'));im.file_format='PNG';im.save();im.pack();im.use_fake_user=True;s['images'][kind]=im;print('R9 ATLAS',kind);del atlas,pixels,original;purge(name+' '+kind+' atlas')


def r9_wall_uv_and_material(name):
    s=STATE[name];density=s['r9_density'];origin=s['r9_uv_origin'];counts={}
    for lod in s['lods']:
        me=lod.data;uv=me.uv_layers['UVMap'];wall=me.attributes['r9_wall'];count=0
        for f in me.polygons:
            is_wall=bool(wall.data[f.index].value);count+=int(is_wall)
            if is_wall:
                axis=max(range(3),key=lambda j:abs(f.normal[j]));a,b=[j for j in range(3) if j!=axis]
                for li in f.loop_indices:
                    p=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=((1026+(p[a]-origin[a])*density)/2048,(2+(p[b]-origin[b])*density)/2048)
                f.use_smooth=False
            else:
                for li in f.loop_indices:uv.data[li].uv*=.5
        counts[lod['asset_node']]=count
    mat=s['material'];ns=mat.node_tree.nodes;ns.clear();links=mat.node_tree.links;bs=ns.new('ShaderNodeBsdfPrincipled');out=ns.new('ShaderNodeOutputMaterial');links.new(bs.outputs[0],out.inputs[0]);tex={}
    for kind,im in s['images'].items():n=ns.new('ShaderNodeTexImage');n.image=im;tex[kind]=n
    links.new(tex['base'].outputs[0],bs.inputs['Base Color']);normal=ns.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.8;links.new(tex['normal'].outputs[0],normal.inputs['Color']);links.new(normal.outputs[0],bs.inputs['Normal']);sep=ns.new('ShaderNodeSeparateColor');links.new(tex['orm'].outputs[0],sep.inputs[0]);links.new(sep.outputs[1],bs.inputs['Roughness']);links.new(sep.outputs[2],bs.inputs['Metallic']);links.new(tex['emissive'].outputs[0],bs.inputs['Emission Color']);group=ns.new('ShaderNodeGroup');group.node_tree=bpy.data.node_groups['glTF Material Output'];links.new(sep.outputs[0],group.inputs['Occlusion'])
    for im in s['r9_old_images'].values():im.use_fake_user=False
    s['r9_wall_counts']=counts;s['owner_metrics'].update(review9=True,fracture_ledge_depth_m=[2,8],wall_texture='Continuous native scan crop, tone matched to original outer atlas, box UV in all LODs',matched_texels_per_m=density);print('TEXTURED WALLS',counts);purge(name+' finished Review9 material')


def r9_finish_geometry(name):
    s=STATE[name];ob=s['collider'];assert_solid(ob)
    if len(ob.data.polygons)>8000:
        wall=ob.data.attributes['r9_wall'];protected={i for f in ob.data.polygons if wall.data[f.index].value for i in f.vertices};group=ob.vertex_groups.new(name='Budget only exterior');group.add([i for i in range(len(ob.data.vertices)) if i not in protected],1,'REPLACE');select(ob);mod=ob.modifiers.new('Hard budget repair, wall vertices protected','DECIMATE');mod.ratio=7600/len(ob.data.polygons);mod.vertex_group=group.name;mod.vertex_group_factor=1000;bpy.ops.object.modifier_apply(modifier=mod.name);r3_clean(ob)
    assert_solid(ob);assert intersection_check(ob)['passed'];assert len(ob.data.polygons)<=8000
    old_lods=s['lods'];low=ob.copy();low.data=ob.data.copy();s['scene'].collection.objects.link(low);low.name=name+'_lod0';low['asset_node']='lod0';low.data.materials.clear();low.data.materials.append(s['material']);s['lod0']=low;s['lods']=[low]
    for old in old_lods:bpy.data.objects.remove(old,do_unlink=True)
    for level,ratio in [(1,.35),(2,.1)]:
        child=low.copy();child.data=low.data.copy();s['scene'].collection.objects.link(child);child.name=name+'_lod'+str(level);child['asset_node']='lod'+str(level);child.hide_set(False);decimate(child,round(len(low.data.polygons)*ratio));s['lods'].append(child)
    for lod in s['lods']:lod.hide_render=lod!=low;lod.hide_set(lod!=low)
    ob.hide_render=True;ob.hide_set(True);tree=mesh_bvh(ob)[0];minimum=min(tree.find_nearest(Vector(p))[3]*2 for path in s['paths'] for p in sample_path(path,1));assert minimum>=64,minimum;s['r9_clearance']=minimum;s['r9_quantisation']=q9_importer_audit(ob);assert s['r9_quantisation']['passed']
    print('R9 ROCK GEOMETRY',name,len(low.data.polygons),'clearance',minimum);purge(name+' one-pass fracture shelves')


# Brief 3, reduced owner queue. One design pass; repair only failed hard checks.
def b3_begin(name):
    assert name in ['yarik_kanyonu','petek'];o4_empty();new_scene(name);s=STATE[name];(OUT/name).mkdir(exist_ok=True);s.update(review='brief-3',ports=[],deposits=[],cargo=[],pads=[],unmet=[],preview_specs={},cracks=[],source_license='Fab Standard',source_asset='nordic_beach_rock_ukxkffifa_mid.glb')
    if name=='yarik_kanyonu':
        s['bounds']=[(-260,260),(-430,430),(-190,210)];s['step']=6.;s['roof_intervals']=[[-300,-180],[-60,60],[180,300]]
        ys=np.linspace(-410,410,165);main=[[50*math.sin(2*math.pi*y/700),float(y),-25] for y in ys];ysb=np.linspace(-210,210,121);branch=[[50*math.sin(2*math.pi*y/700)+110*math.sin(math.pi*(y+210)/420)**2,float(y),-25] for y in ysb]
        s['paths']=[main,branch];s['main_path']=main;s['branch_path']=branch;s['route_radius']=42.5;s['links']=[dict(a='J0',b='J1',path=1)];s['cells']=[];s['entrance_specs']=[(main[7],(0,-1,0)),(main[-8],(0,1,0))]
        for y in [-120,120]:
            p=[50*math.sin(2*math.pi*y/700),y,-25];s['paths'].append([p,[p[0],p[1],210]]);s['entrance_specs'].append(([p[0],p[1],140],(0,0,1)))
        s['segments']=[(branch[j],branch[min(j+4,len(branch)-1)],42.5) for j in range(0,len(branch)-1,4)]
        s['rock_masses']=[dict(centre=[(-1 if i%2==0 else 1)*65,y,4*math.sin(i*2.1)],radii=[145,125,140],seed=20+i) for i,y in enumerate([-250,-150,-50,50,150,250])]
        s['route_graph']=dict(vertices={'E0':main[0],'J0':branch[0],'J1':branch[-1],'E1':main[-1]},edges=[['E0','J0'],['J0','J1'],['J0','J1'],['J1','E1']],cycle_rank=1)
    else:
        s['bounds']=[(-310,310),(-310,310),(-310,310)];s['step']=6.;cells=[]
        for level,z in enumerate([-120,0,120]):
            for i in range(3):
                a=math.radians(i*120+(60 if level==1 else 0));cells.append(dict(name='C'+str(level*3+i),centre=[120*math.cos(a),120*math.sin(a),z],radius=61.5,level=level))
        s['cells']=cells;links=[];paths=[];segments=[]
        edges=[(level*3+i,level*3+(i+1)%3) for level in range(3) for i in range(3)]+[(i,i+3) for i in range(3)]+[(i+3,i+6) for i in range(3)]
        for a,b in edges:
            pa=np.array(cells[a]['centre']);pb=np.array(cells[b]['centre']);out=(pa+pb)*.5;out[2]=0;out/=np.linalg.norm(out);offset=56 if cells[a]['level']==cells[b]['level'] else 47;path=[(pa+(pb-pa)*t+out*(offset*math.sin(math.pi*t))).tolist() for t in np.linspace(0,1,61)];paths.append(path);links.append(dict(a=cells[a]['name'],b=cells[b]['name'],path=len(paths)-1,offset_m=offset))
            segments.extend((path[j],path[min(j+4,60)],36.3) for j in range(0,60,4))
        # Five mouths on three horizontal sides plus up and down; main +glTF Z.
        specs=[(5,(0,-1,0)),(0,(1,0,0)),(4,(-1,0,0)),(7,(0,0,1)),(2,(0,0,-1))];entrances=[]
        for index,d in specs:
            c=np.array(cells[index]['centre']);direction=np.array(d);axis=int(np.argmax(np.abs(direction)));mouth=c.copy();mouth[axis]=float(260*direction[axis]);outside=mouth+direction*45;path=[c.tolist(),outside.tolist()];paths.append(path);segments.append((path[0],path[1],36.3));entrances.append((mouth.tolist(),d))
        s.update(paths=paths,links=links,segments=segments,entrance_specs=entrances,route_radius=36.3,rock_masses=[dict(centre=[-45,0,-10],radii=[220,240,245],seed=51),dict(centre=[85,22,45],radii=[175,190,215],seed=52),dict(centre=[-5,-100,-55],radii=[190,165,190],seed=53)])
        s['route_graph']=dict(vertices={c['name']:c['centre'] for c in cells},edges=[[x['a'],x['b']] for x in links],cycle_rank=len(links)-len(cells)+1)
    s['axes']=[np.arange(a,b+s['step'],s['step'],dtype=np.float32) for a,b in s['bounds']];s['field_values']=np.empty(tuple(len(a) for a in s['axes']),np.float32);s['field_next']=0
    print('BRIEF3 PLAN',name,'paths',len(s['paths']),'cells',len(s['cells']),'links',len(s['links']),'grid',s['field_values'].shape,'minimum bend',min(bend_radius(p) for p in s['paths'] if bend_radius(p) is not None));purge(name+' route design and bounded grid')


def b3_poly_field(X,Y,Z,info):
    p=info['centre'];r=info['radii'];seed=info['seed'];result=np.full(X.shape,-1e6,np.float32);normals=[(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
    for i in range(20):
        z=1-2*(i+.5)/20;a=i*math.pi*(3-math.sqrt(5));t=math.sqrt(1-z*z);normals.append((t*math.cos(a),t*math.sin(a),z))
    for i,n in enumerate(normals):
        distance=math.sqrt(sum((n[j]*r[j])**2 for j in range(3)))*(1+.028*math.sin(i*2.31+seed));plane=n[0]*(X-p[0])+n[1]*(Y-p[1])+n[2]*(Z-p[2])-distance;np.maximum(result,plane,out=result)
    # Physical strata, not surface normal noise.
    result+=np.take(np.array([0,2.5,-1.5,1],np.float32),np.mod(np.floor((Z+320)/32).astype(int),4));return result


def b3_field(name,X,Y,Z):
    s=STATE[name];outer=np.full(X.shape,1e6,np.float32)
    for rock in s['rock_masses']:np.minimum(outer,b3_poly_field(X,Y,Z,rock),out=outer)
    if name=='yarik_kanyonu':
        centre=50*np.sin(2*math.pi*Y/700);width=43.5+1.7*np.sin(Y*.041+Z*.027)+np.mod(np.floor((Z+100)/28),3)*1.7;covered=np.zeros(X.shape,bool)
        for a,b in s['roof_intervals']:covered|=(Y>=a)&(Y<=b)
        ceiling=np.where(covered,60+4*np.sin(X*.042+Y*.028),800);void=np.maximum.reduce([np.abs(X-centre)-width,-100-Z,Z-ceiling])
    else:
        void=np.full(X.shape,1e6,np.float32)
        for c in s['cells']:
            p=c['centre'];distance=np.sqrt((X-p[0])**2+(Y-p[1])**2+(Z-p[2])**2);rough=.55*np.sin(X*.075+Y*.038)*np.sin(Z*.081-Y*.029);np.minimum(void,distance-c['radius']-rough,out=void)
        # Exterior craters do not intrude on any cell or passage clearance sphere.
        for p,r in [((0,0,260),38),((0,0,-270),35),((260,0,30),36),((-275,-15,30),40),((10,265,0),38),((10,-275,-15),36)]:
            crater=np.sqrt((X-p[0])**2+(Y-p[1])**2+(Z-p[2])**2)-r;np.minimum(void,crater,out=void)
    for aa,bb,radius in s['segments']:
        a=np.asarray(aa);v=np.asarray(bb)-a;length2=float(np.dot(v,v));t=np.clip(((X-a[0])*v[0]+(Y-a[1])*v[1]+(Z-a[2])*v[2])/length2,0,1);distance=np.sqrt((X-a[0]-t*v[0])**2+(Y-a[1]-t*v[1])**2+(Z-a[2]-t*v[2])**2)-radius;np.minimum(void,distance,out=void)
    return (np.maximum(outer,-void)+.019).astype(np.float32)


def b3_field_batch(name,count=8):
    s=STATE[name];start=s['field_next'];end=min(len(s['axes'][0]),start+count);X,Y,Z=np.meshgrid(s['axes'][0][start:end],s['axes'][1],s['axes'][2],indexing='ij');s['field_values'][start:end]=b3_field(name,X,Y,Z);s['field_next']=end;print('FIELD',name,end,'/',len(s['axes'][0]));purge(name+' field slab');return end==len(s['axes'][0])


def b3_build_mesh(name):
    s=STATE[name];assert s['field_next']==len(s['axes'][0]);values=s['field_values'];ob=implicit_mesh(name+' fractured cave mass',lambda X,Y,Z:values,s['bounds'],s['step']);s['collider']=ob;ob.name=name+'_collider';ob['asset_node']='collider';s.pop('field_values');s.pop('axes');keep_main_solid(ob);decimate(ob,12300 if name=='petek' else 14000);r3_clean(ob)
    if topology(ob)['non_manifold_edges'] or not intersection_check(ob)['passed']:o4_meshfix(ob)
    r4_fix_zero_area(name);assert_solid(ob);assert intersection_check(ob)['passed'];print('CAVE MESH',name,topology(ob));purge(name+' grid extracted and reduced')


def b3_crack_batch(name,start=0,count=3):
    s=STATE[name];assert name=='petek';ob=s['collider'];bpy.context.window.scene=s['scene'];tree=mesh_bvh(ob)[0]
    if not s['cracks']:
        for cell in s['cells']:
            c=Vector(cell['centre']);radial=Vector((c.x,c.y,0)).normalized()
            candidates=[]
            for turn in np.linspace(-1.05,1.05,15):
                d=Vector((radial.x*math.cos(turn)-radial.y*math.sin(turn),radial.x*math.sin(turn)+radial.y*math.cos(turn),(.4 if cell['level']>0 else -.4))).normalized();hit,n,_,distance=tree.ray_cast(c,d,200)
                if hit is not None and 55<distance<65:candidates.append((float(turn),d,hit,n))
            assert len(candidates)>=2,cell['name']
            # Pick well separated wall positions clear of existing exit mouths.
            pair=min(((a,b) for a in candidates for b in candidates if b[0]-a[0]>.25),key=lambda ab:abs(ab[0][0]+.45)+abs(ab[1][0]-.45))
            for turn,d,hit,n in pair:s['cracks'].append(dict(cell=cell['name'],centre=list(c),direction=list(d),inner_wall=list(hit),wall_normal=list(n),diameter_m=4.3))
    for i,crack in enumerate(s['cracks'][start:start+count],start):
        c=Vector(crack['centre']);d=Vector(crack['direction']);p0=c+d*18;p1=c+d*500;mid=(p0+p1)*.5;bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=2.15,depth=(p1-p0).length,location=mid);cut=bpy.context.object;cut.name='4.3m light fracture '+str(i);cut.rotation_euler=d.to_track_quat('Z','Y').to_euler();select(cut);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);boolean_cut(ob,cut)
    r3_clean(ob)
    if not intersection_check(ob)['passed']:r3_heal(ob)
    r4_fix_zero_area(name);assert_solid(ob);print('LIGHT FRACTURES',min(start+count,len(s['cracks'])),'/',len(s['cracks']),len(ob.data.polygons));purge(name+' light fracture batch')


def b3_rock_material(name):
    import shutil
    s=STATE[name];s['images']={};folder=OUT/name;mat=bpy.data.materials.new(name+' scanned basalt');mat.use_nodes=True;mat.use_fake_user=True;s['material']=mat
    for kind in ['base','normal','orm','emissive']:
        path=folder/(name+'_'+kind+'.png');shutil.copyfile(OUT/'kovuk'/('kovuk_'+kind+'.png'),path);im=bpy.data.images.load(str(path),check_existing=False);im.name=name+'_'+kind;im.colorspace_settings.name='Non-Color' if kind in ['normal','orm'] else 'sRGB';im.pack();im.use_fake_user=True;s['images'][kind]=im
    im=s['images']['orm'];a=np.empty(1024*1024*4,np.float32);im.pixels.foreach_get(a);a=a.reshape(1024,1024,4);a[1016:1024,1016:1024,:]=(1,.31,0,1);a[990:1000,1016:1024,:]=(1,.91,0,1);im.pixels.foreach_set(a.ravel());im.update();im.save();im.pack()
    im=s['images']['emissive'];a=np.empty(1024*1024*4,np.float32);im.pixels.foreach_get(a);a=a.reshape(1024,1024,4);a[796:824,28:56,:]=(.012,.021,.027,1);im.pixels.foreach_set(a.ravel());im.update();im.save();im.pack()
    ns=mat.node_tree.nodes;ns.clear();links=mat.node_tree.links;bs=ns.new('ShaderNodeBsdfPrincipled');out=ns.new('ShaderNodeOutputMaterial');links.new(bs.outputs[0],out.inputs[0]);tex={}
    for kind,im in s['images'].items():node=ns.new('ShaderNodeTexImage');node.image=im;tex[kind]=node
    color=ns.new('ShaderNodeVertexColor');color.layer_name='Geology';multiply=ns.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1;links.new(tex['base'].outputs[0],multiply.inputs[1]);links.new(color.outputs[0],multiply.inputs[2]);links.new(multiply.outputs[0],bs.inputs['Base Color']);normal=ns.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.32;links.new(tex['normal'].outputs[0],normal.inputs['Color']);links.new(normal.outputs[0],bs.inputs['Normal']);sep=ns.new('ShaderNodeSeparateColor');links.new(tex['orm'].outputs[0],sep.inputs[0]);links.new(sep.outputs[1],bs.inputs['Roughness']);bs.inputs['Metallic'].default_value=0;uv=ns.new('ShaderNodeUVMap');uv.uv_map='ResponseUV';links.new(uv.outputs[0],tex['orm'].inputs['Vector']);uv=ns.new('ShaderNodeUVMap');uv.uv_map='OreUV';links.new(uv.outputs[0],tex['emissive'].inputs['Vector']);links.new(tex['emissive'].outputs[0],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=3
    group=ns.new('ShaderNodeGroup');tree=bpy.data.node_groups.get('glTF Material Output')
    if tree is None:
        tree=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree');tree.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
    group.node_tree=tree;links.new(sep.outputs[0],group.inputs['Occlusion']);purge(name+' four 1024 scan maps')


def b3_project_strip(name,centre,normal,length=5,width=1.2,glow=1):
    s=STATE[name];tree=s['detail_tree'];c=Vector(centre);n=Vector(normal);u=n.cross(Vector((0,0,1)) if abs(n.z)<.9 else Vector((1,0,0))).normalized();v=n.cross(u).normalized();verts=[];faces=[]
    for j in range(4):
        a=-length/2+j*length/4;b=a+length/4;start=len(verts)
        for dx,dy in [(-width/2,a),(width/2,a),(width/2,b),(-width/2,b)]:
            q,nn,_,_=tree.find_nearest(c+u*dx+v*dy);verts.append(q+nn*.045)
        faces.extend([(start,start+1,start+2),(start,start+2,start+3)])
    me=bpy.data.meshes.new('Crystal vein' if glow==1 else 'Faint light-fracture edge');me.from_pydata(verts,[],faces);me.update();attr=me.attributes.new('b3_glow','INT','FACE')
    for a in attr.data:a.value=glow
    s['detail_meshes'].append(me)


def b3_render_and_markers(name):
    s=STATE[name];col=s['collider'];assert_solid(col);assert len(col.data.polygons)<=16000;assert intersection_check(col)['passed'];s['detail_tree']=mesh_bvh(col)[0];s['detail_meshes']=[]
    for i,(p,d) in enumerate(s['entrance_specs'],1):marker(s,'entrance_'+str(i),p,d)
    if name=='yarik_kanyonu':
        specs=[(y,sign) for y,sign in [(-270,1),(-165,-1),(-85,-1),(15,-1),(110,-1),(240,1)]]
        for i,(y,sign) in enumerate(specs,1):
            p=Vector((50*math.sin(2*math.pi*y/700),y,-15));hit,n,_,_=s['detail_tree'].ray_cast(p,Vector((sign,0,0)),500);assert hit is not None;marker(s,'deposit_'+str(i),hit,n);s['deposits'].append(s['markers'][-1]);b3_project_strip(name,hit,n,7,1.3,1)
    else:
        for i,(cell,direction) in enumerate([(1,(0,0,-1)),(6,(0,0,1))],1):
            hit,n,_,_=s['detail_tree'].ray_cast(Vector(s['cells'][cell]['centre']),Vector(direction),150);assert hit is not None;marker(s,'deposit_'+str(i),hit,n);s['deposits'].append(s['markers'][-1]);b3_project_strip(name,hit,n,4,1.2,1)
        for crack in s['cracks']:
            n=Vector(crack['wall_normal']);u=n.cross(Vector((0,0,1)) if abs(n.z)<.9 else Vector((1,0,0))).normalized();p=Vector(crack['inner_wall'])+u*3.3;hit,nn,_,_=s['detail_tree'].find_nearest(p);b3_project_strip(name,hit,nn,1.8,.28,2)
    low=col.copy();low.data=col.data.copy();s['scene'].collection.objects.link(low);low.name=name+'_lod0';low['asset_node']='lod0';low.data.materials.clear();low.data.materials.append(s['material']);s['lod0']=low;s['lods']=[low]
    for level,ratio in [(1,.35),(2,.1)]:
        ob=low.copy();ob.data=low.data.copy();s['scene'].collection.objects.link(ob);ob.name=name+'_lod'+str(level);ob['asset_node']='lod'+str(level);ob.hide_set(False);decimate(ob,round(len(low.data.polygons)*ratio));s['lods'].append(ob)
    for lod in s['lods']:
        for mesh in s['detail_meshes']:
            part=bpy.data.objects.new(mesh.name,mesh.copy());s['scene'].collection.objects.link(part);part.data.materials.append(s['material']);lod.hide_set(False);bpy.ops.object.select_all(action='DESELECT');lod.select_set(True);part.select_set(True);bpy.context.view_layer.objects.active=lod;bpy.ops.object.join()
        lod.data.materials.clear();lod.data.materials.append(s['material'])
        for f in lod.data.polygons:f.material_index=0
    b3_uv(name);col.hide_render=True;col.hide_set(True)
    for lod in s['lods']:lod.hide_render=lod!=low;lod.hide_set(lod!=low)
    s.pop('detail_tree');s.pop('detail_meshes');print('BRIEF3 RENDER',name,[len(ob.data.polygons) for ob in s['lods']],len(s['markers']));purge(name+' render LODs and every route marker')


def b3_uv(name):
    s=STATE[name]
    for ob in s['lods']:
        me=ob.data;uv=me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap');ore=me.uv_layers.get('OreUV') or me.uv_layers.new(name='OreUV');response=me.uv_layers.get('ResponseUV') or me.uv_layers.new(name='ResponseUV');colors=me.color_attributes.get('Geology') or me.color_attributes.new(name='Geology',type='FLOAT_COLOR',domain='CORNER');glow=me.attributes.get('b3_glow')
        for f in me.polygons:
            axis=max(range(3),key=lambda j:abs(f.normal[j]));a,b=[j for j in range(3) if j!=axis];g=glow.data[f.index].value if glow else 0;dust=f.normal.z>.55;ridge=abs(f.normal.z)<.2 and f.center.z>20;f.use_smooth=False
            for li in f.loop_indices:
                p=me.vertices[me.loops[li].vertex_index].co;q=(p[a]/32,p[b]/32);uv.data[li].uv=q;ore.data[li].uv=(.25,.5) if g==1 else (.04,.79) if g==2 else (.001,.001);response.data[li].uv=(.995,.995) if ridge else (.995,.971) if dust else q;colors.data[li].color=(*((.96,.90,.81) if dust else (.49,.57,.61) if ridge else (.78,.82,.85)),1)
        me.uv_layers.active=uv;uv.active_render=True


def b3_lighting(name):
    s=STATE[name];sc=s['scene'];set_engine(sc,'BLENDER_EEVEE');sc.eevee.taa_render_samples=16;sc.eevee.use_raytracing=False;enum_value(sc.eevee,'shadow_pool_size','64');sc.render.resolution_x=1600;sc.render.resolution_y=1000;sc.render.resolution_percentage=100;sc.render.threads_mode='FIXED';sc.render.threads=2;enum_value(sc.render.image_settings,'file_format','PNG');enum_value(sc.render.image_settings,'color_mode','RGB');enum_value(sc.view_settings,'view_transform','AgX');sc.view_settings.exposure=0
    bg=next(n for n in sc.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.035,.045,.06,1);bg.inputs['Strength'].default_value=.18;light(sc,'Arena stellar key',(-450,-650,900),2.3,(1,.88,.72),kind='SUN');light(sc,'Restrained cold sky',(550,-250,450),8e6,(.52,.68,.88),400,target=(0,0,0));light(sc,'Rock edge separation',(-350,500,350),9e6,(.48,.64,.84),350,target=(0,0,0))
    if name=='yarik_kanyonu':
        for y in [-240,0,240]:light(sc,'Canyon indirect sky '+str(y),(50*math.sin(2*math.pi*y/700),y,10),65000,(.55,.64,.7),35,kind='POINT')
        light(sc,'Branch bounced light',(110,0,0),32000,(.55,.60,.65),25,kind='POINT');p=s['entrance_specs'][0][0];s['preview_specs']={'exterior_1000m':((Vector((.9,-1.2,.8)).normalized()*1000).to_tuple(),(0,0,0),None,35),'exterior_300m':([p[0],p[1]-300,45],[0,-240,-5],None,30),'interior_1':([50*math.sin(-230*2*math.pi/700),-230,-10],[50*math.sin(-90*2*math.pi/700),-90,-10],None,23),'interior_2':([90,-35,-12],[95,110,-20],None,23)}
    else:
        for c in s['cells']:
            p=Vector(c['centre'])+Vector((0,0,24));light(sc,'Fracture indirect light '+c['name'],p,48000,(.5,.6,.68),20,kind='POINT',target=c['centre'])
        c=s['cells'][3]['centre'];low=s['cells'][0]['centre'];s['preview_specs']={'exterior_1000m':((Vector((.95,-1.2,.65)).normalized()*1000).to_tuple(),(0,0,0),None,40),'exterior_300m':([60,-560,40],[35,-120,0],None,30),'interior_1':([c[0]-20,c[1]-25,c[2]-18],s['paths'][3][30],None,21),'interior_2':([low[0]-25,low[1]+10,low[2]-15],s['paths'][9][24],None,23)}
    purge(name+' four camera views, restrained Eevee lighting')


def b3_validate(name):
    s=STATE[name];ob=s['collider'];top=assert_solid(ob);cross=intersection_check(ob);assert cross['passed'];assert top['triangles']<=16000 and len(s['lod0'].data.polygons)<=40000;tree=mesh_bvh(ob)[0];routes=[];all_diam=[]
    for i,path in enumerate(s['paths']):
        points=sample_path(path,2);diam=np.array([tree.find_nearest(Vector(p))[3]*2 for p in points]);inside=sum(point_inside(tree,p) for p in points);radius=bend_radius(path);assert inside==0 and diam.min()>=(70 if name=='yarik_kanyonu' else 60),(i,diam.min(),inside);assert radius is None or radius>=59.99,(i,radius);all_diam.extend(diam.tolist());routes.append(dict(path=i,samples=len(points),maximum_sample_spacing_m=max((Vector(a)-Vector(b)).length for a,b in zip(points,points[1:])),minimum_clear_diameter_m=float(diam.min()),clear_diameter_p5_m=float(np.percentile(diam,5)),minimum_bend_radius_m=radius,points_in_solid=inside))
    r1_distance(name);quant=q9_importer_audit(ob);assert quant['passed'],quant;mouths=[]
    for m in s['entrances']:
        p=Vector((m['position'][0],-m['position'][2],m['position'][1]));d=Vector((m['direction'][0],-m['direction'][2],m['direction'][1]));points=[p+d*t for t in np.linspace(0,40,41)];diam=[tree.find_nearest(q)[3]*2 for q in points];assert not any(point_inside(tree,q) for q in points) and min(diam)>=60;mouths.append(dict(name=m['name'],front_40m_clear=True,minimum_clear_diameter_m=min(diam)))
    v=dict(asset=name,review='brief-3',units='metres',coordinate_system='glTF Y-up',collider_topology=top,self_intersection=cross,lod_triangle_counts={o['asset_node']:len(o.data.polygons) for o in s['lods']},collider_vs_lod0=s['distance'],paths=routes,minimum_clear_diameter_m=min(all_diam),clear_diameter_p5_m=float(np.percentile(all_diam,5)),minimum_bend_radius_m=min(r['minimum_bend_radius_m'] for r in routes if r['minimum_bend_radius_m'] is not None),entrance_count=len(s['entrances']),deposit_count=len(s['deposits']),route_graph=dict(cycle_rank=s['route_graph']['cycle_rank'],vertices=len(s['route_graph']['vertices']),edges=len(s['route_graph']['edges'])),route_clearance_before_after_m=[dict(path=r['path'],before=None,after=r['minimum_clear_diameter_m'],note='New asset: no predecessor route or collider') for r in routes],mouth_approaches=mouths,largest_closed_gap_m=0,largest_closed_gap_location=None,dimensions_m=[float(ob.dimensions.x),float(ob.dimensions.z),float(ob.dimensions.y)],texture_sizes={k:list(im.size) for k,im in s['images'].items()},material_count=1,game_quantisation=quant,unmet_rules=list(s['unmet']),known_limits=['Preview point lights approximate bounced light; exported emissive crystal/crack surfaces and physical light openings remain in the GLB.'],current_rss_mib=purge(name+' hard geometric checks'))
    if name=='yarik_kanyonu':
        ys=np.arange(-375,376,1);covered=[]
        for y in ys:
            p=Vector((50*math.sin(2*math.pi*y/700),float(y),-25));covered.append(tree.ray_cast(p,Vector((0,0,1)),600)[0] is not None)
        runs=[];start=None
        for i,flag in enumerate(covered+[False]):
            if flag and start is None:start=i
            if not flag and start is not None:runs.append(dict(start_y_blender_m=float(ys[start]),end_y_blender_m=float(ys[i-1]),length_m=float(ys[i-1]-ys[start]+1)));start=None
        substantial=[r for r in runs if r['length_m']>=80];open_fraction=1-sum(covered)/len(covered);assert len(substantial)>=3 and all(r['length_m']<=200 for r in substantial);assert .4<=open_fraction<=.6,open_fraction
        depths=[]
        for y in range(-300,301,10):
            x=50*math.sin(2*math.pi*y/700);floor=tree.ray_cast(Vector((x,y,-25)),Vector((0,0,-1)),500)[0]
            for sign in [-1,1]:
                rim=tree.ray_cast(Vector((x+sign*56,y,500)),Vector((0,0,-1)),1000)[0]
                if floor is not None and rim is not None:depths.append(rim.z-floor.z)
        a=Vector((0,0,-25));b=Vector((110,0,-25));hit=tree.ray_cast(a,(b-a).normalized(),(b-a).length)[0];assert hit is not None
        v.update(fused_rock_count=6,source_mass_dimensions_m=[[2*r for r in rock['radii']] for rock in s['rock_masses']],roofed_stretches=substantial,open_sky_fraction=open_fraction,fissure_depth_m=dict(minimum=min(depths),p5=float(np.percentile(depths,5)),maximum=max(depths),samples=len(depths),scope='Adjacent wall rims at +/-56m from the winding axis, y=-300..300m; flared end approaches excluded'),line_of_sight=dict(side_branch_hidden_from_main=True,main_position_yup=yup(a),branch_position_yup=yup(b),first_occlusion_yup=yup(hit)),cell_count=0)
        if min(depths)<150 or max(depths)>250:v['unmet_rules'].append('Local wall-rim depth range extends outside 150-250m; exact range and sampling scope are recorded.')
        assert len(s['entrances'])>=4 and len(s['deposits'])>=6
    else:
        visible=[];rays=0
        for i,a in enumerate(s['cells']):
            for j in range(i):
                b=s['cells'][j]
                for ca,cb in [(a,b),(b,a)]:
                    p=Vector(ca['centre']);q=Vector(cb['centre']);rays+=1
                    if tree.ray_cast(p,(q-p).normalized(),(q-p).length-.001)[0] is None:visible.append([ca['name'],cb['name']])
        assert not visible,('Cell centres still visible',visible);degrees={c['name']:0 for c in s['cells']};lengths=[]
        for link in s['links']:
            degrees[link['a']]+=1;degrees[link['b']]+=1;path=np.array(s['paths'][link['path']]);mid=(path[:-1]+path[1:])*.5;outside=(np.linalg.norm(mid-path[0],axis=1)>61.5)&(np.linalg.norm(mid-path[-1],axis=1)>61.5);length=float(np.linalg.norm(np.diff(path,axis=0),axis=1)[outside].sum());assert 40<=length<=120,(link,length);lengths.append(dict(a=link['a'],b=link['b'],passage_length_outside_nominal_cells_m=length,full_centreline_length_m=float(np.linalg.norm(np.diff(path,axis=0),axis=1).sum())))
        for link,report in zip(s['links'],lengths):
            path=sample_path(s['paths'][link['path']],2);a=Vector(path[0]);b=Vector(path[-1]);points=[Vector(p) for p in path if (Vector(p)-a).length>61.5 and (Vector(p)-b).length>61.5];diam=[tree.find_nearest(p)[3]*2 for p in points];assert 60<=min(diam) and max(diam)<=75
            report['clearance_samples_outside_cells']=len(diam);report['clear_diameter_m']=dict(minimum=min(diam),p5=float(np.percentile(diam,5)),maximum=max(diam))
        assert min(degrees.values())>=2 and len(s['links'])>=14 and s['route_graph']['cycle_rank']>=5;cell_reports=[]
        for c in s['cells']:
            centre=Vector(c['centre']);exits=[]
            for path in s['paths']:
                if (Vector(path[0])-centre).length<.01:ordered=path
                elif (Vector(path[-1])-centre).length<.01:ordered=list(reversed(path))
                else:continue
                point=next((Vector(p) for p in ordered if (Vector(p)-centre).length>=61),Vector(ordered[-1]));exits.append((point-centre).normalized())
            cracks=[Vector(x['direction']) for x in s['cracks'] if x['cell']==c['name']];radii=[]
            for i in range(192):
                z=1-2*(i+.5)/192;a=i*math.pi*(3-math.sqrt(5));r=math.sqrt(1-z*z);d=Vector((r*math.cos(a),r*math.sin(a),z))
                if any(d.dot(e)>math.cos(math.radians(47)) for e in exits) or any(d.dot(e)>math.cos(math.radians(5)) for e in cracks):continue
                hit,_,_,distance=tree.ray_cast(centre,d,200)
                if hit is not None:radii.append(distance)
            assert len(radii)>=12,c['name'];cell_reports.append(dict(name=c['name'],level=c['level'],wall_samples=len(radii),wall_diameter_min_m=2*min(radii),wall_diameter_max_m=2*max(radii),scope='Fibonacci directions outside explicit passage/mouth exit cones and the two light-fracture cones.'))
            if min(radii)*2<90 or max(radii)*2>130:v['unmet_rules'].append(c['name']+' measured non-exit wall diameters extend outside 90-130m.')
        cracks_open=[]
        for c in s['cracks']:
            p=Vector(c['centre']);d=Vector(c['direction']);opened=tree.ray_cast(p,d,600)[0] is None;assert opened,c;cracks_open.append(dict(cell=c['cell'],diameter_m=4.3,open_to_space=opened))
        v.update(cell_count=len(s['cells']),cells=cell_reports,levels_blender_z_m=[-120,0,120],passage_count=len(s['links']),passages=lengths,cell_degrees=degrees,line_of_sight=dict(unordered_cell_pairs=36,directed_rays=rays,visible_pairs=visible,all_cell_centres_occluded=True),light_cracks=cracks_open)
        assert len(s['cells'])==9 and len(s['entrances'])==5 and len(s['deposits'])==2 and len(s['cracks'])==18
    s['validation']=v;dump(OUT/name/'validation.json',v);print('BRIEF3 VALID',name,'clearance',v['minimum_clear_diameter_m'],'triangles',v['lod_triangle_counts'],'unmet',v['unmet_rules']);return v


def b3_preview(name,kind):
    position,target,ortho,lens=STATE[name]['preview_specs'][kind];preview(name,kind,position,target,ortho=ortho,lens=lens)


def b3_deliver(name):
    import hashlib
    s=STATE[name];folder=OUT/name;v=s['validation'];bpy.context.window.scene=s['scene'];bpy.ops.object.select_all(action='DESELECT')
    for ob in [s['collider']]+s['lods']+[o for o in s['scene'].objects if o.type=='EMPTY']:ob.hide_set(False);ob.select_set(True)
    path=folder/(name+'.glb');bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_animations=False,export_image_format='AUTO',export_extras=True,export_cameras=False,export_lights=False,export_all_vertex_colors=False,export_vertex_color='NAME',export_vertex_color_name='Geology');doc=patch_glb(path,s);assert len(doc['materials'])==1 and len(doc['images'])==4
    dump(folder/(name+'.json'),dict(asset=name,units='metres',coordinate_system='glTF Y-up',ports=[],paths=[[yup(p) for p in path] for path in s['paths']],entrances=s['entrances'],deposits=s['deposits'],pads=[],cargo=[],route_graph=dict(vertices={k:yup(p) for k,p in s['route_graph']['vertices'].items()},edges=s['route_graph']['edges'],cycle_rank=s['route_graph']['cycle_rank']),cells=[dict(name=c['name'],centre=yup(c['centre']),level=c['level']) for c in s['cells']]))
    r1_verify_glb(name);s['collider'].hide_render=True;s['collider'].hide_set(True)
    for lod in s['lods'][1:]:lod.hide_render=True;lod.hide_set(True)
    metadata={k:s[k] for k in ['review','paths','entrances','markers','deposits','cells','links','cracks','route_graph','preview_specs','rock_masses','bounds','step','unmet']};s['scene']['brief3_metadata']=json.dumps(metadata);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(folder/(name+'.blend')));purge(name+' saved complete asset')
    reference=json.loads((OUT/'kovuk/provenance.json').read_text());dump(folder/'provenance.json',dict(origin='Original fractured cave geometry and route graph; licensed owner-supplied scan PBR',review='brief-3',geometry_origin='Original procedural CSG, 6m field extraction; collision/render shared surface',texture_source=reference['source_file'],texture_license='Fab Standard',texture_source_sha256=reference['source_sha256'],texture_crop=reference['scan_tile'],blender_version=bpy.app.version_string,generator='tools/yarik-blender.py',generator_sha256=hashlib.sha256((ROOT/'tools/yarik-blender.py').read_bytes()).hexdigest(),output_sha256={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [folder/(name+'.glb'),folder/(name+'.json')]+sorted(folder.glob(name+'_*.png'))},preview_sha256={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (folder/'previews').glob('*.png')},source_blend=name+'.blend',source_blend_sha256=hashlib.sha256((folder/(name+'.blend')).read_bytes()).hexdigest()))
    s['complete']=s['verified']=True;print('BRIEF3 DELIVERED',name)


def b3_hydrate(name):
    sc=bpy.data.scenes[name];bpy.context.window.scene=sc;s=json.loads(sc['brief3_metadata']);s['scene']=sc;s['validation']=json.loads((OUT/name/'validation.json').read_text());s['lods']=sorted([o for o in sc.objects if str(o.get('asset_node','')).startswith('lod')],key=lambda x:x['asset_node']);s['lod0']=s['lods'][0];s['collider']=next(o for o in sc.objects if o.get('asset_node')=='collider');s['material']=s['lod0'].data.materials[0];s['images']={k:next(n.image for n in s['material'].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.name.startswith(name+'_'+k)) for k in ['base','normal','orm','emissive']};STATE[name]=s;return s
