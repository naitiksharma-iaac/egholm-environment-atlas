"""Make a small, attributed drawing-space copy; leave all source files unchanged."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'Data/youaremyStudent/fromChatGPT/Egholm_Site_Inputs/data/base'
ORIGIN = (551219, 6324858)
SCALE = .23

def point(p):
    return [round((p[0]-ORIGIN[0])*SCALE, 2), round((ORIGIN[1]-p[1])*SCALE, 2)]

def simplify(points, tolerance=1.2):
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    dx, dy = b[0]-a[0], b[1]-a[1]
    denominator = dx*dx+dy*dy
    distances=[]
    for p in points[1:-1]:
        t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/denominator)) if denominator else 0
        distances.append(((p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2)**.5)
    greatest=max(distances)
    if greatest <= tolerance:
        return [a,b]
    i=distances.index(greatest)+1
    return simplify(points[:i+1],tolerance)[:-1]+simplify(points[i:],tolerance)

coast_json=json.loads((SOURCE/'coastline_25832.geojson').read_text())
coast=[]
for f in coast_json['features']:
    polygons=f['geometry']['coordinates'] if f['geometry']['type']=='MultiPolygon' else [f['geometry']['coordinates']]
    for poly in polygons:
        coast.append([simplify([point(p) for p in ring]) for ring in poly])
vegetation=json.loads((SOURCE/'vegetation_25832.geojson').read_text())
woods=[]
trees=[]
hedges=[]
for f in vegetation['features']:
    g=f['geometry']
    if g['type']=='Point':
        trees.append(point(g['coordinates']))
    elif g['type']=='LineString':
        hedges.append(simplify([point(p) for p in g['coordinates']]))
    else:
        polygons=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
        woods.extend([[simplify([point(p) for p in ring],.6) for ring in poly] for poly in polygons])
data={'coast':coast,'woods':woods,'trees':trees,'hedges':hedges,'source':{'attribution':'© OpenStreetMap contributors','license':'ODbL 1.0','url':'https://www.openstreetmap.org/copyright','coastlineWay':156597303,'sourceCRS':'EPSG:25832','drawingOrigin':ORIGIN,'drawingUnitsPerMetre':SCALE,'note':'Simplified copies of existing project shoreline and vegetation. Ground colour, puddles, clearings and dyke lines are illustrative scenarios, not surveyed land cover.'}}
text='/* Simplified project geometry; © OpenStreetMap contributors, ODbL 1.0. */\n(function(root){const data='+json.dumps(data,separators=(',',':'))+';if(typeof module!=="undefined"&&module.exports)module.exports=data;else root.EgholmLandscapeData=data;})(typeof globalThis!=="undefined"?globalThis:this);\n'
(HERE/'landscape-data.js').write_text(text,encoding='utf-8')
print(json.dumps({'coast_polygons':len(coast),'woodland_polygons':len(woods),'trees':len(trees),'bytes':len(text.encode())}))
