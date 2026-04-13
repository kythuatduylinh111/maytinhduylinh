import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export type ProcessingMode = "Chính xác" | "Tốc độ" | "Chuyên nghiệp";

export interface ProductContent {
  seoDescription: string;
  technicalSpecs: string;
  imageUrls: string[];
  productTags: string[];
  yoastFocusKeyword: string;
}

export interface GenerationParams {
  productName: string;
  imageBase64?: string;
  mode?: ProcessingMode;
  rawText?: string;
}

export async function generateProductContent(params: GenerationParams): Promise<ProductContent> {
  const { productName, imageBase64, mode = "Chuyên nghiệp", rawText } = params;
  const model = "gemini-3-flash-preview";

  let thinkingLevel = ThinkingLevel.LOW;
  if (mode === "Chính xác") thinkingLevel = ThinkingLevel.HIGH;
  if (mode === "Chuyên nghiệp") thinkingLevel = ThinkingLevel.HIGH;

  const systemInstruction = `
    VAI TRÒ: Bạn là chuyên gia biên tập nội dung E-commerce và chuyên gia kỹ thuật phần cứng máy tính.
    CHẾ ĐỘ XỬ LÝ: ${mode}. 
    ${mode === "Chính xác" ? "Ưu tiên độ chính xác tuyệt đối của thông số kỹ thuật." : ""}
    ${mode === "Tốc độ" ? "Ưu tiên nội dung ngắn gọn, súc tích và phản hồi nhanh." : ""}
    ${mode === "Chuyên nghiệp" ? "Ưu tiên giọng văn sang trọng, chuyên nghiệp và tối ưu SEO chuyên sâu." : ""}
    
    NHIỆM VỤ: Tiếp nhận thông tin từ người dùng, tra cứu/xác thực thông số kỹ thuật chính xác và tạo nội dung chuẩn SEO cho website.
    DỮ LIỆU BỔ SUNG: ${rawText ? `Người dùng đã cung cấp thông tin thô sau đây, hãy ƯU TIÊN sử dụng thông tin này để đảm bảo độ chính xác: ${rawText}` : "Không có dữ liệu thô bổ sung."}

    QUY TẮC TRÌNH BÀY (BẮT BUỘC):
    1. Nội dung chia làm 2 phần rõ rệt:
       - Phần 1: Mô tả sản phẩm. Viết đoạn văn ngắn gọn, thu hút, tối ưu từ khóa SEO dựa trên tên sản phẩm. Sử dụng các thẻ Heading (H2, H3) để phân đoạn. BẮT BUỘC sử dụng 2 dấu xuống dòng giữa các đoạn văn và sau tiêu đề để Markdown hiển thị chính xác. In đậm các tính năng nổi bật bằng dấu **. Giọng văn: Chuyên nghiệp, khách quan và thu hút.
       - Phần 2: Thông số kỹ thuật. Liệt kê từng dòng, BẮT BUỘC có dấu gạch đầu dòng (-) ở đầu mỗi dòng. Mỗi thông số một dòng riêng biệt. BẮT BUỘC có 1 dấu xuống dòng giữa các dòng thông số. Không sử dụng bảng, không chèn liên kết.
    2. Ngôn ngữ: Tiếng Việt.
    3. Nếu có hình ảnh đi kèm, hãy trích xuất các đặc điểm ngoại hình nổi bật (màu sắc, cổng kết nối, chất liệu) để đưa vào phần mô tả.
  `;

  const contents: any[] = [
    {
      text: `Dữ liệu đầu vào:
      Tên sản phẩm: ${productName}
      ${imageBase64 ? "Dựa vào hình ảnh được cung cấp, hãy trích xuất các đặc điểm ngoại hình nổi bật để đưa vào phần mô tả." : ""}`
    }
  ];

  if (imageBase64) {
    contents.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64.split(",")[1] || imageBase64
      }
    });
  }

  // 1. Generate SEO and Specs
  const contentResponse = await ai.models.generateContent({
    model,
    contents: { parts: contents },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          seoDescription: { type: Type.STRING, description: "Mô tả sản phẩm chuẩn SEO (Markdown)" },
          technicalSpecs: { type: Type.STRING, description: "Thông số kỹ thuật (Dòng theo dòng, bắt đầu bằng -)" },
          productTags: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Danh sách 5-10 thẻ sản phẩm (tags) liên quan" 
          },
          yoastFocusKeyword: { 
            type: Type.STRING, 
            description: "Cụm từ khóa chính tối ưu cho Yoast SEO (thường là tên sản phẩm kèm đặc tính nổi bật)" 
          },
        },
        required: ["seoDescription", "technicalSpecs", "productTags", "yoastFocusKeyword"],
      },
    },
  });

  const contentData = JSON.parse(contentResponse.text || "{}");

  return {
    seoDescription: contentData.seoDescription || "Không có mô tả.",
    technicalSpecs: contentData.technicalSpecs || "Không có thông số.",
    productTags: contentData.productTags || [],
    yoastFocusKeyword: contentData.yoastFocusKeyword || "",
    imageUrls: [], // Image search removed as requested
  };
}

export async function analyzeImageForName(base64: string): Promise<string> {
  const model = "gemini-3-flash-preview";
  const response = await ai.models.generateContent({
    model,
    contents: [
      { inlineData: { mimeType: "image/jpeg", data: base64.split(',')[1] || base64 } },
      { text: "Identify the product in this image. Return ONLY the product name, short and concise (max 5 words). Do not include any other text." }
    ]
  });
  return response.text?.trim() || "";
}
