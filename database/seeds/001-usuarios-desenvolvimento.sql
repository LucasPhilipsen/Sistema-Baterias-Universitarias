-- Contas fictícias exclusivas para desenvolvimento e testes.
-- As senhas de demonstração estão documentadas em database/README.md.
INSERT INTO usuarios (nome, email, senha_hash, perfil)
VALUES
  (
    'Diretoria de Demonstração',
    'diretoria@bateria.example',
    'scrypt$131072$8$1$e36879fdd2460760cb4038699c303f60$7ea63ba57e999b69b74c8ae2f3afff757d1e1eff9591c0f4d8164bc870599a20945e339b83a2ad97cb52f693745f3ab2547a1562c99232af1ac93f24be8d7ba2',
    'DIRETORIA'
  ),
  (
    'Integrante de Demonstração',
    'integrante@bateria.example',
    'scrypt$131072$8$1$487d8adbacd97c22c5e9024c1e3be3ec$f6e3ca5c8a37916d50946eed894eca239f6f6245a8471426775d7bfb69d48959858a1fbd2370bef95ecbd392bdc45f80b03e9828fac74c3a82c875913b3b7d0f',
    'INTEGRANTE'
  )
ON CONFLICT (email) DO NOTHING;
