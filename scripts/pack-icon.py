import pathlib, struct, sys
source = pathlib.Path(sys.argv[1])
chunks = []
for tag, name in [('icp4','16x16'),('ic11','16x16@2x'),('icp5','32x32'),('ic12','32x32@2x'),('ic07','128x128'),('ic13','128x128@2x'),('ic08','256x256'),('ic14','256x256@2x'),('ic09','512x512'),('ic10','512x512@2x')]:
    image = (source / ('icon_'+name+'.png')).read_bytes()
    assert image.startswith(b'\x89PNG')
    chunks.append(tag.encode()+struct.pack('>I',8+len(image))+image)
payload=b''.join(chunks)
pathlib.Path(sys.argv[2]).write_bytes(b'icns'+struct.pack('>I',8+len(payload))+payload)
