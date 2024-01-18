import { PyBridge } from 'pybridge';

const pythonCode = `
from sentence_transformers import SentenceTransformer

embedder = SentenceTransformer('./all-MiniLM-L6-v2')

def embed(texts):
    return embedder.encode(texts).tolist()
`;

export interface PythonAPI {
    embed(text: string[]): number[][];
}

const bridge = new PyBridge({ python: 'python3', cwd: process.cwd() });
export const pythonApi = bridge.controller<PythonAPI>(pythonCode);
