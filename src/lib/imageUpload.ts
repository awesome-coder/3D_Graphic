const MAX_FILE_SIZE = 8 * 1024 * 1024
const MAX_DIMENSION = 1400
const COMPRESS_THRESHOLD = 900 * 1024

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解析失败'))
    image.src = url
  })
}

export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件')
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
    throw new Error('支持 PNG、JPG、WebP 或 GIF 图片')
  }
  if (file.size > MAX_FILE_SIZE) throw new Error('图片不能超过 8 MB')
  const original = await readAsDataUrl(file)
  if (file.type === 'image/gif') return original
  const image = await loadImage(original)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height))
  if (scale === 1 && file.size <= COMPRESS_THRESHOLD) return original

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) return original
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const compressed = canvas.toDataURL('image/webp', 0.86)
  return compressed.startsWith('data:image/webp') ? compressed : original
}

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'
export const IMAGE_TIP = 'PNG / JPG / WebP / GIF · 单张 ≤ 8 MB，自动压缩至 1400 px'
