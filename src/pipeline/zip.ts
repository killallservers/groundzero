import JSZip from 'jszip'

type FileTree = Record<string, string>

export async function buildZip(files: FileTree): Promise<Uint8Array> {
  const zip = new JSZip()

  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content)
  }

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}
