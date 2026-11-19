#!/usr/bin/env python3
"""Read-only original IZ2S artwork conversion. Python stdlib only."""
import json
import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[7]
ICONS = {
    "blitbun": "modules/BlitBun/switch/icon.png",
    "book-reader": "modules/BookReader/switch/assets/icon.png",
    "iz-file-deck": "modules/Foldrift/switch/assets/icon.png",
    "iz2s-cheese": "modules/iz2s-cheese/switch/iza/assets/icon.png",
    "izpsx": "modules/IZPSX/switch/icon.png",
    "vacootube": "modules/VacooTube/switch/icon.png",
}
ATLAS = "engines/CivSwitch/launcher/app/assets/focus-type.png"
TYPE_REGIONS = {
    "title": (2, 2, 458, 59), "add": (2, 162, 402, 60),
    "browse": (2, 227, 314, 22), "packages": (2, 349, 154, 12),
    "empty": (2, 437, 240, 22), "ready": (2, 86, 290, 33),
    "library": (2, 332, 123, 12), "select": (2, 847, 74, 14),
    "back": (2, 866, 62, 14),
}
CHANNELS = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}
PASSES = ((0, 0, 8, 8), (4, 0, 8, 8), (0, 4, 4, 8),
          (2, 0, 4, 4), (0, 2, 2, 4), (1, 0, 2, 2), (0, 1, 1, 2))

def png_rgba(filename):
    blob = Path(filename).read_bytes()
    if len(blob) > 8*1024*1024 or not blob.startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError("Invalid PNG input")
    offset, header, palette, transparent, compressed, finished = 8, None, b'', b'', [], False
    while offset+12 <= len(blob):
        size, = struct.unpack_from('>I', blob, offset)
        kind = blob[offset+4:offset+8]
        if size > 8*1024*1024 or offset+size+12 > len(blob):
            raise ValueError("Truncated PNG")
        part = blob[offset+8:offset+8+size]
        offset += 12+size
        if kind == b'IHDR':
            if header or len(part) != 13:
                raise ValueError("Invalid PNG IHDR")
            w,h,depth,color,comp,filt,interlace = struct.unpack('>IIBBBBB',part)
            if not (0<w<=4096 and 0<h<=4096 and w*h<=4194304) or color not in CHANNELS or depth not in (1,2,4,8,16) or comp or filt or interlace not in (0,1) or (color in (2,4,6) and depth<8) or (color==3 and depth==16):
                raise ValueError("Unsupported PNG format")
            header = w,h,depth,color,interlace
        elif kind == b'PLTE':
            if len(part)>768 or len(part)%3: raise ValueError("Invalid palette")
            palette=part
        elif kind == b'tRNS': transparent=part
        elif kind == b'IDAT': compressed.append(part)
        elif kind == b'IEND':
            finished=True
            break
        elif kind and not (kind[0]&32):
            raise ValueError("Unsupported critical PNG chunk")
    if not header or not finished or not compressed:
        raise ValueError("Incomplete PNG")
    w,h,depth,color,interlace = header
    if color==3 and not palette: raise ValueError("Missing PNG palette")
    channels=CHANNELS[color]
    plans=PASSES if interlace else ((0,0,1,1),)
    sizes=[]
    expected=0
    for x0,y0,dx,dy in plans:
        pw=max(0,(w-x0+dx-1)//dx)
        ph=max(0,(h-y0+dy-1)//dy)
        rowbytes=(pw*channels*depth+7)//8
        if pw and ph: expected+=ph*(rowbytes+1)
        sizes.append((x0,y0,dx,dy,pw,ph,rowbytes))
    if expected>64*1024*1024: raise ValueError("PNG expansion exceeds limit")
    z=zlib.decompressobj()
    raw=z.decompress(b''.join(compressed),expected+1)
    raw+=z.flush()
    if len(raw)!=expected or not z.eof: raise ValueError("PNG inflated size differs")
    rgba=bytearray(w*h*4)
    bpp=max(1,(channels*depth+7)//8)
    pos=0
    for x0,y0,dx,dy,pw,ph,rowbytes in sizes:
        if not pw or not ph: continue
        prior=bytearray(rowbytes)
        for py in range(ph):
            filt=raw[pos]
            pos+=1
            row=bytearray(raw[pos:pos+rowbytes])
            pos+=rowbytes
            if filt>4: raise ValueError("Unsupported PNG filter")
            for i in range(rowbytes):
                a=row[i-bpp] if i>=bpp else 0
                b=prior[i]
                c=prior[i-bpp] if i>=bpp else 0
                correction=0
                if filt==1: correction=a
                elif filt==2: correction=b
                elif filt==3: correction=(a+b)//2
                elif filt==4:
                    q=a+b-c
                    da,db,dc=abs(q-a),abs(q-b),abs(q-c)
                    correction=a if da<=db and da<=dc else b if db<=dc else c
                row[i]=(row[i]+correction)&255
            def sample(px,ch):
                bit=(px*channels+ch)*depth
                at=bit//8
                if depth==16: return (row[at]<<8)|row[at+1]
                if depth==8: return row[at]
                return (row[at]>>(8-depth-bit%8))&((1<<depth)-1)
            def to8(n):
                return (n+128)//257 if depth==16 else n if depth==8 else (n*255)//((1<<depth)-1)
            for px in range(pw):
                target=((y0+py*dy)*w+x0+px*dx)*4
                if color==6: rgba[target:target+4]=bytes(to8(sample(px,i)) for i in range(4))
                elif color==4:
                    g=to8(sample(px,0))
                    rgba[target:target+4]=bytes((g,g,g,to8(sample(px,1))))
                elif color==2:
                    rgb=tuple(sample(px,i) for i in range(3))
                    alpha=0 if len(transparent)>=6 and rgb==struct.unpack('>HHH',transparent[:6]) else 255
                    rgba[target:target+4]=bytes((*map(to8,rgb),alpha))
                elif color==0:
                    gray=sample(px,0)
                    alpha=0 if len(transparent)>=2 and gray==struct.unpack('>H',transparent[:2])[0] else 255
                    g=to8(gray)
                    rgba[target:target+4]=bytes((g,g,g,alpha))
                else:
                    ix=sample(px,0)
                    if ix*3+2>=len(palette): raise ValueError("Invalid palette index")
                    rgba[target:target+4]=bytes((*palette[ix*3:ix*3+3],transparent[ix] if ix<len(transparent) else 255))
            prior=row
    return w,h,rgba

def icon_hex(source):
    w,h,pixels=png_rgba(ROOT/source)
    scale=min(40/w,40/h)
    ox,oy=(40-w*scale)/2,(40-h*scale)/2
    parts=[]
    for y in range(40):
        for x in range(40):
            u=(x+0.5-ox)/scale-0.5
            v=(y+0.5-oy)/scale-0.5
            if not (-0.5<=u<w-0.5 and -0.5<=v<h-0.5):
                parts.append("0000")
                continue
            xx=max(0,min(w-1,round(u)))
            yy=max(0,min(h-1,round(v)))
            r,g,b,a=pixels[(yy*w+xx)*4:(yy*w+xx+1)*4]
            parts.append(f'{r>>4:x}{g>>4:x}{b>>4:x}{a>>4:x}')
    return ''.join(parts)

def glyph_hex(atlas,rect):
    w,h,pixels=atlas
    if (w,h)!=(768,1216): raise ValueError("Original CivSwitch atlas dimensions mismatch")
    x,y,cw,ch=rect
    bits=[]
    for yy in range(ch):
        for xx in range(cw):
            off=((y+yy)*w+x+xx)*4
            r,g,b,a=pixels[off:off+4]
            bits.append(int(((r+g+b)//3)*a//255>=90))
    return ''.join(f'{sum(bits[k+j]<<(3-j) for j in range(min(4,len(bits)-k))):x}' for k in range(0,len(bits),4))

def main():
    if len(sys.argv)!=2 or sys.argv[1] not in ("icons","atlas"):
        raise SystemExit("Usage: python canonical-visual-assets.py icons|atlas")
    output=[]
    if sys.argv[1]=="icons":
        for ident,source in ICONS.items():
            try:
                output.append({"id":ident,"format":"rgba4444","w":40,"h":40,"data":icon_hex(source)})
            except (ValueError,OSError) as error:
                print(f'SKIP {ident}: {error}',file=sys.stderr)
    else:
        atlas=png_rgba(ROOT/ATLAS)
        for ident,rect in TYPE_REGIONS.items():
            output.append({"id":"type-"+ident,"format":"alpha1","w":rect[2],"h":rect[3],"data":glyph_hex(atlas,rect)})
    print(json.dumps(output,separators=(",",":")))

if __name__=="__main__": main()
