# Spec: Leitura QR Code de NFC-e pela Camera

## Visao Geral

Implementacao de leitura de QR Code de Notas Fiscais de Consumidor Eletronica (NFC-e) diretamente pela camera do celular, com extracao automatica dos dados estruturados via browser-harness.

## Status

**Implementado em:** 2026-08-22
**Versao:** 1.0.0

## Funcionalidade

### Fluxo Principal

1. Usuario acessa "Nova Nota Fiscal"
2. Tela de escolha: "Ler QR Code" ou "Enviar Foto"
3. Ao selecionar "Ler QR Code":
   - Camera traseira do celular e ativada (html5-qrcode)
   - QR Code detectado em tempo real
   - URL extraida do QR Code (formato SEFAZ)
4. URL enviada para `/api/invoices/from-qr`
5. Backend invoca browser-harness como subprocesso
6. browser-harness navega para URL SEFAZ
7. Aguarda auto-submit do formulario JSF (~8s)
8. Extrai `innerText` da pagina renderizada
9. Parseia dados estruturados em `InvoiceData`
10. Cria invoice no banco de dados
11. Redireciona para pagina de revisao

### Fallback

Se o QR Code falhar ou nao for detectado, o usuario pode usar o fluxo de upload de imagem (OCR) como alternativa.

## Arquivos Criados/Modificados

### Novos

| Arquivo | Descricao |
|---------|-----------|
| `src/components/QRCodeScanner.tsx` | Componente de camera com html5-qrcode |
| `src/lib/nfce-urls.ts` | Mapa estado -> URL SEFAZ (27 estados) |
| `src/lib/nfce-scraper.ts` | Scraper via browser-harness + parser de texto |
| `src/app/api/invoices/from-qr/route.ts` | API endpoint para processamento por QR Code |
| `SPEC-QRCODE-NFCE.md` | Esta especificacao |

### Modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/InvoiceUpload.tsx` | Adicionado fluxo de escolha (QR Code vs Foto) |
| `src/components/InvoiceReview.tsx` | Badge "QR Code" ou "OCR" indicando fonte dos dados |
| `src/app/notas-fiscais/[id]/revisao/page.tsx` | Passa `source` para InvoiceReview |
| `src/types/invoice.ts` | Adicionado campo `barcode` no InvoiceItem |
| `package.json` | Adicionada dependencia `html5-qrcode` |

## Dependencias

### Frontend
- `html5-qrcode` - Leitura de QR Code pela camera do navegador

### Backend
- `browser-harness` (uv tool) - Navegacao web via CDP
- Chrome com remote debugging habilitado

## API

### POST `/api/invoices/from-qr`

**Request:**
```json
{
  "url": "https://consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode?p=33260833304981000381651820002926351004445537|2|1|3|9F95BF4DEDC36A7E3E9500BE8B023EB85728BA36"
}
```

**Response:**
```json
{
  "invoice": {
    "id": "...",
    "storeName": "SUPERMERCADOS MUNDIAL LTDA",
    "storeId": "...",
    "invoiceNumber": "NF-1234567890",
    "date": "2026-08-22T14:16:32.000Z",
    "total": 97.01,
    "totalItemsCount": 7,
    "items": [
      {
        "id": "...",
        "name": "ROSQUINHA RANCHEIRO CHOCOLATE 300G",
        "quantity": 1,
        "unit": "un",
        "unitPrice": 3.99,
        "totalPrice": 3.99,
        "barcode": "69147"
      }
    ]
  },
  "source": "qr_code"
}
```

## Formato QR Code NFC-e

### Estrutura da URL

```
{base_url_sefaz}?p={chave_acesso}|{versao}|{ambiente}|{csc_id}|{hash}
```

### Exemplo (RJ)

```
https://consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode?p=33260833304981000381651820002926351004445537|2|1|3|9F95BF4DEDC36A7E3E9500BE8B023EB85728BA36
```

### Parametros

| Parametro | Descricao |
|-----------|-----------|
| chave_acesso | 44 digitos identificadores da NF-e |
| versao | Versao do QR Code (2 ou 3) |
| ambiente | 1=Producao, 2=Homologacao |
| csc_id | Identificador do CSC (v2) |
| hash | Código de seguranca (v2) ou assinatura (v3) |

## Estados Suportados

Todos os 27 estados brasileiros com portal de consulta NFC-e:

AC, AL, AM, AP, BA, CE, DF, ES, GO, MA, MG, MS, MT, PA, PB, PE, PI, PR, RJ, RN, RO, RR, RS, SC, SE, SP, TO

## Browser-Harness

### Configuracao

1. Instalado via: `uv tool install --python 3.12 --upgrade --force browser-harness`
2. Skill registrada em: `~/.agents/skills/browser-harness/SKILL.md`
3. Chrome remote debugging: `chrome://inspect/#remote-debugging`

### Execucao

O scraper invoca browser-harness como subprocesso:

```bash
echo "import time; import json; new_tab('URL'); time.sleep(8); text = js('document.body.innerText'); print(json.dumps({'ok': True, 'text': text}))" | browser-harness
```

### Parser

O parser `parseNfceText` extrai:
- Nome do estabelecimento
- CNPJ
- Data de emissao
- Itens (nome, codigo, quantidade, unidade, preco unitario, preco total)
- Valor total
- Forma de pagamento

## Limitacoes Conhecidas

### Descontos por Item

O portal SEFAZ nao fornece descontos detalhados por item. Descontos sao mostrados apenas no total da nota fiscal ("Descontos R$: X,XX"). Itens com desconto individual aparecem com o valor total cheio no portal, e o desconto e aplicado apenas no total geral.

**Workaround:** O usuario deve ajustar manualmente os itens com desconto na pagina de revisao.

### Headless Mode

O browser-harness local requer Chrome visivel para conexao CDP. Para operacao headless, e necessario usar Browser Use Cloud (servico pago). A aba e fechada automaticamente apos a extracao dos dados.

## Notas Tecnicas

### Por que browser-harness e nao fetch direto?

A pagina SEFAZ utiliza JavaScript (JSF/RichFaces) para:
1. Auto-submit de formulario
2. Renderizacao dinamica dos dados
3. Protecao contra bots (TSPD/Akamai)

O fetch direto retorna apenas o HTML inicial com scripts. browser-harness executa o JavaScript e retorna o conteudo renderizado.

### performance

- Tempo medio: ~10s (8s espera + 2s scraping)
- Chrome deve estar aberto com remote debugging
- browser-harness ja instalado e conectado

## Resolucao de Problemas

### Chrome nao conecta

```bash
browser-harness --doctor
```

Se `daemon alive` FAIL: habilitar remote debugging em `chrome://inspect/#remote-debugging`

### Timeout na extracao

Aumentar o timeout em `nfce-scraper.ts` (atual: 30s)

### QR Code nao detectado

Verificar se a camera esta funcionando e se o QR Code esta visivel. O componente usa `facingMode: "environment"` (camera traseira).
