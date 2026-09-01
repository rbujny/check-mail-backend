import { GoogleAuth } from "google-auth-library";

export class CloudStorageJsonWriter {
  private readonly auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/devstorage.read_write"],
  });

  constructor(private readonly bucket: string) {}

  async write(object: string, value: unknown): Promise<void> {
    const client = await this.auth.getClient();
    await client.request({
      url: `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(this.bucket)}/o`,
      method: "POST",
      params: {
        ifGenerationMatch: 0,
        name: object,
        uploadType: "media",
      },
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      data: JSON.stringify(value),
    });
  }
}
