import { FunctionDeclaration, Type } from "@google/genai";

// 1. Tool Definition (Function Declaration)
export const printifyProductCreatorTool: FunctionDeclaration = {
  name: "printify_product_creator",
  description: "Creates a new Printify product directly via the cloud backend.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      shopId: {
        type: Type.STRING,
        description: "The user's Printify Shop ID.",
      },
      products_data: {
        type: Type.OBJECT,
        description: "The JSON object containing the product data structure.",
      },
    },
    required: ["shopId", "products_data"],
  },
};

// 2. Tool Execution Logic
export const executePrintifyProductCreator = async (shopId: string, products_data: any) => {
  const ENDPOINT = "https://printify-uploader.glamorousdes1.workers.dev/api/printify/create";

  console.log(`[Tool] Executing printify_product_creator for Shop ID: ${shopId}`);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        storeId: shopId,
        ...products_data
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tool Execution Failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("[Tool] Execution Error:", error);
    throw error;
  }
};