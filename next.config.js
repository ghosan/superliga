/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración para Vercel
  output: 'standalone',
  
  // Permitir imágenes externas si es necesario
  images: {
    domains: [],
  },
}

module.exports = nextConfig

