import { BlobNotFoundError, get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { BLOB_MEDIA_PATHNAME_REGEX } from "@/lib/validators/painel";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pathname: string[] }> },
) {
  const { pathname: segments } = await context.params;
  const pathname = segments.join("/");

  if (!BLOB_MEDIA_PATHNAME_REGEX.test(pathname)) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Armazenamento indisponível." },
      { status: 503 },
    );
  }

  try {
    const result = await get(pathname, {
      access: "private",
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Imagem não encontrada." },
        { status: 404 },
      );
    }

    const headers = new Headers({
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });

    if (result.blob.etag) {
      headers.set("ETag", result.blob.etag);
    }

    if (result.statusCode === 304) {
      return new NextResponse(null, { status: 304, headers });
    }

    headers.set(
      "Content-Type",
      result.blob.contentType || "application/octet-stream",
    );

    return new NextResponse(result.stream, { status: 200, headers });
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return NextResponse.json(
        { error: "Imagem não encontrada." },
        { status: 404 },
      );
    }
    console.error("Erro ao servir mídia do Vercel Blob:", error);
    return NextResponse.json(
      { error: "Erro ao carregar imagem." },
      { status: 500 },
    );
  }
}
