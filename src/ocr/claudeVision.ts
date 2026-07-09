import Anthropic from '@anthropic-ai/sdk'
import { OcrError, type OcrProvider, type OcrResult } from './types'

// 옵션 (A): 비전 모델 API에 프레임 이미지를 보내 청구기호를 왼→오른 순서 배열(JSON)로 추출.
// 브라우저에서 직접 Anthropic API를 호출하므로 API 키가 클라이언트에 노출된다 — 개인/테스트
// 용도로만 사용할 것을 UI에서 안내한다(Settings 컴포넌트 참고).
const MODEL = 'claude-opus-4-8'

type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

function splitDataUrl(dataUrl: string): { mediaType: SupportedMediaType; base64: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/s)
  if (!match) throw new OcrError('이미지 데이터 형식을 읽을 수 없습니다.')
  const raw = match[1]
  const supported: SupportedMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const mediaType = (supported as string[]).includes(raw) ? (raw as SupportedMediaType) : 'image/jpeg'
  return { mediaType, base64: match[2] }
}

const CALL_NUMBER_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: { type: 'string' },
      description: '사진 속 책등에 적힌 청구기호 원문을 왼쪽에서 오른쪽 순서대로 나열한 배열',
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const

export class ClaudeVisionProvider implements OcrProvider {
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async recognize(imageDataUrl: string): Promise<OcrResult> {
    const { mediaType, base64 } = splitDataUrl(imageDataUrl)
    const client = new Anthropic({ apiKey: this.apiKey, dangerouslyAllowBrowser: true })

    let response
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        output_config: {
          format: { type: 'json_schema', schema: CALL_NUMBER_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              {
                type: 'text',
                text:
                  '이 사진은 도서관 서가 책등의 청구기호 라벨입니다. [별치기호] 분류기호 도서기호 [부가기호] ' +
                  '형태입니다(예: "004.73 박25ㅇ", "아 843.5 23ㅇ v.2", "004.73 박883ㅇ v.2026", "004.73 반44초 c.2"). ' +
                  '각 책의 청구기호를 사진 속 왼쪽에서 오른쪽 순서 그대로 읽어 items 배열로 반환하세요. ' +
                  '글자가 흐릿해도 보이는 그대로 최대한 옮겨 적고, 책이 아닌 것은 포함하지 마세요.',
              },
            ],
          },
        ],
      })
    } catch (err) {
      throw new OcrError(err instanceof Error ? err.message : '인식 요청에 실패했습니다.')
    }

    if (response.stop_reason === 'refusal') {
      throw new OcrError('모델이 이 이미지 인식을 거부했습니다. 수동으로 입력해 주세요.')
    }

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    )
    if (!textBlock) throw new OcrError('인식 결과를 받지 못했습니다.')

    try {
      const parsed = JSON.parse(textBlock.text) as { items?: unknown }
      if (!Array.isArray(parsed.items)) throw new Error('items가 배열이 아닙니다.')
      return { texts: parsed.items.filter((t): t is string => typeof t === 'string') }
    } catch {
      throw new OcrError('인식 결과를 해석할 수 없습니다.')
    }
  }
}
