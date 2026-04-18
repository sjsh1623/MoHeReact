// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// ESM 환경에서 __dirname 을 사용할 수 있게 변환해 주는 코드
import { fileURLToPath, URL } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// 빌드 타임스탬프 생성 (캐시 버스팅용)
const buildTimestamp = Date.now().toString();

// 버전 정보 생성 플러그인
function versionPlugin() {
  return {
    name: 'version-plugin',
    buildStart() {
      // version.json 파일 생성
      const versionInfo = {
        version: buildTimestamp,
        buildTime: new Date().toISOString(),
      };

      // public 폴더에 version.json 생성
      const publicDir = path.resolve(__dirname, 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(
        path.resolve(publicDir, 'version.json'),
        JSON.stringify(versionInfo, null, 2)
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), versionPlugin()],
  define: {
    // 빌드 타임스탬프를 전역 변수로 주입
    '__APP_VERSION__': JSON.stringify(buildTimestamp),
    '__BUILD_TIME__': JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  },
  build: {
    // 캐시 버스팅을 위한 파일명 해시 설정
    rollupOptions: {
      output: {
        // 청크 파일에 해시 추가
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // 소스맵 생성 (디버깅용)
    sourcemap: false,
  },
  server: {
    host: '0.0.0.0', // Allow external connections for mobile testing and Docker
    port: 3000,
    strictPort: true, // Fail if port is already in use
    allowedHosts: [
      'mohe.today',
      '.mohe.today', // Include all subdomains
      'mohe-react-dev', // Allow Docker internal hostname
      'localhost',
      '127.0.0.1'
    ],
    watch: {
      usePolling: true, // Docker 환경에서 파일 변경 감지를 위해 필요
      interval: 100, // 폴링 간격 (ms)
    },
    hmr: {
      // Enable HMR for fast development feedback
      overlay: true, // Show errors in browser overlay
      clientPort: 3000, // HMR client port
      host: 'localhost', // HMR host
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      },
      // Dev 전용: /image/* → 이미지 프로세서로 직접 프록시 (Caddy 우회)
      // 프로덕션은 Caddyfile 의 handle /image/* 블록이 처리
      '/image': {
        target: 'http://localhost:5200',
        changeOrigin: true,
        secure: false,
      },
    }
  }
});