import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export class BoilerplateGenerator {
  private templates: Map<string, any> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    this.templates.set('express-api', {
      name: 'Express API',
      description: 'API REST com Express.js',
      files: [
        { path: 'src/app.ts', content: this.getExpressAppTemplate() },
        { path: 'src/server.ts', content: this.getExpressServerTemplate() },
        { path: 'package.json', content: this.getExpressPackageJson() },
        { path: 'tsconfig.json', content: this.getTSConfig() },
        { path: '.gitignore', content: this.getGitIgnore() },
        { path: 'README.md', content: this.getExpressReadme() }
      ]
    });

    this.templates.set('react-app', {
      name: 'React App',
      description: 'Aplicação React com TypeScript',
      files: [
        { path: 'src/App.tsx', content: this.getReactAppTemplate() },
        { path: 'src/index.tsx', content: this.getReactIndexTemplate() },
        { path: 'src/styles.css', content: this.getReactStylesTemplate() },
        { path: 'public/index.html', content: this.getReactHtmlTemplate() },
        { path: 'package.json', content: this.getReactPackageJson() },
        { path: 'tsconfig.json', content: this.getTSConfig() },
        { path: 'vite.config.ts', content: this.getViteConfig() },
        { path: '.gitignore', content: this.getGitIgnore() },
        { path: 'README.md', content: this.getReactReadme() }
      ]
    });

    this.templates.set('fastapi-app', {
      name: 'FastAPI App',
      description: 'API REST com FastAPI',
      files: [
        { path: 'app/main.py', content: this.getFastAPIMainTemplate() },
        { path: 'requirements.txt', content: this.getFastAPIRequirements() },
        { path: '.gitignore', content: this.getGitIgnore() },
        { path: 'README.md', content: this.getFastAPIReadme() }
      ]
    });
  }

  createFromTemplate(templateName: string, projectPath: string, projectName: string): void {
    const template = this.templates.get(templateName);
    
    if (!template) {
      throw new Error('Template não encontrado: ' + templateName);
    }

    const fullPath = join(projectPath, projectName);
    mkdirSync(fullPath, { recursive: true });

    template.files.forEach((file: any) => {
      const filePath = join(fullPath, file.path);
      const dirPath = join(filePath, '..');
      mkdirSync(dirPath, { recursive: true });
      writeFileSync(filePath, file.content, 'utf-8');
    });
    
    console.log('Projeto criado:', fullPath);
  }

  interpretAndCreate(command: string, projectPath: string): void {
    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes('express') || lowerCommand.includes('api') || lowerCommand.includes('backend')) {
      const projectName = this.extractProjectName(command) || 'express-api';
      this.createFromTemplate('express-api', projectPath, projectName);
    } else if (lowerCommand.includes('react') || lowerCommand.includes('frontend') || lowerCommand.includes('web app')) {
      const projectName = this.extractProjectName(command) || 'react-app';
      this.createFromTemplate('react-app', projectPath, projectName);
    } else if (lowerCommand.includes('fastapi') || lowerCommand.includes('python api')) {
      const projectName = this.extractProjectName(command) || 'fastapi-app';
      this.createFromTemplate('fastapi-app', projectPath, projectName);
    } else {
      throw new Error('Não foi possível identificar o tipo de projeto');
    }
  }

  private extractProjectName(command: string): string | null {
    const match = command.match(/(?:chamado|nomeado|intitulado)\s+["']?(\w+)["']?/i);
    return match ? match[1] : null;
  }

  listTemplates(): any[] {
    return Array.from(this.templates.values());
  }

  private getExpressAppTemplate(): string {
    return `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
`;
  }

  private getExpressServerTemplate(): string {
    return `import app from './app';
import { config } from 'dotenv';

config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
`;
  }

  private getExpressPackageJson(): string {
    const pkg = {
      name: 'express-api',
      version: '1.0.0',
      scripts: {
        dev: 'ts-node-dev src/server.ts',
        build: 'tsc',
        start: 'node dist/server.js'
      },
      dependencies: {
        express: '^4.18.0',
        cors: '^2.8.5',
        helmet: '^7.0.0',
        dotenv: '^16.0.0'
      },
      devDependencies: {
        '@types/express': '^4.17.0',
        '@types/node': '^20.0.0',
        typescript: '^5.0.0',
        'ts-node-dev': '^2.0.0'
      }
    };
    return JSON.stringify(pkg, null, 2);
  }

  private getReactAppTemplate(): string {
    return `import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <h1>React App</h1>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  );
}

export default App;
`;
  }

  private getReactIndexTemplate(): string {
    return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
  }

  private getReactStylesTemplate(): string {
    return `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

button {
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
}
`;
  }

  private getReactHtmlTemplate(): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
`;
  }

  private getReactPackageJson(): string {
    const pkg = {
      name: 'react-app',
      version: '1.0.0',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview'
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        '@vitejs/plugin-react': '^4.0.0',
        typescript: '^5.0.0',
        vite: '^4.4.0'
      }
    };
    return JSON.stringify(pkg, null, 2);
  }

  private getViteConfig(): string {
    return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`;
  }

  private getFastAPIMainTemplate(): string {
    return `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="FastAPI App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
`;
  }

  private getFastAPIRequirements(): string {
    return `fastapi==0.104.0
uvicorn==0.24.0
pydantic==2.5.0
`;
  }

  private getTSConfig(): string {
    const config = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        moduleResolution: 'node',
        resolveJsonModule: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules']
    };
    return JSON.stringify(config, null, 2);
  }

  private getGitIgnore(): string {
    return `node_modules/
dist/
.env
.DS_Store
*.log
`;
  }

  private getExpressReadme(): string {
    return `# Express API

API REST construída com Express.js e TypeScript.

## Instalação

npm install

## Desenvolvimento

npm run dev

## Build

npm run build

## Produção

npm start
`;
  }

  private getReactReadme(): string {
    return `# React App

Aplicação React construída com TypeScript e Vite.

## Instalação

npm install

## Desenvolvimento

npm run dev

## Build

npm run build

## Preview

npm run preview
`;
  }

  private getFastAPIReadme(): string {
    return `# FastAPI App

API REST construída com FastAPI.

## Instalação

pip install -r requirements.txt

## Execução

python app/main.py

## Documentação

Acesse http://localhost:8000/docs para a documentação interativa.
`;
  }
}
