import type { OcrProvider, OcrResult } from './types'

/**
 * 옵션 (C): 인식을 사용하지 않는 fallback provider. 정렬 엔진은 인식 정확도와
 * 무관하게 동작해야 하므로, 이 provider를 선택해도 편집 단계에서 수동으로 입력한
 * 청구기호만으로 앱의 핵심 기능(정렬/오배열 판정)이 완전히 동작한다.
 */
export class ManualOcrProvider implements OcrProvider {
  async recognize(): Promise<OcrResult> {
    return { texts: [] }
  }
}
