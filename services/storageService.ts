
// Replaces client-side IndexedDB with server-side SQLite file storage via API

export interface StoredFile {
    id: string;
    fileData: Blob;
    name: string;
    mimeType: string;
}

export const saveFile = async (id: string, file: File): Promise<void> => {
  try {
    const response = await fetch(`/api/files/${id}`, {
        method: 'POST',
        headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'X-Filename': file.name
        },
        body: file
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Server Error (${response.status}): ${errorText}`);
    }
  } catch (e) {
      console.error("Failed to upload file", e);
      throw e;
  }
};

export const getFile = async (id: string): Promise<StoredFile | undefined> => {
  try {
      const response = await fetch(`/api/files/${id}`);
      if (!response.ok) return undefined;
      
      const blob = await response.blob();
      const name = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'unknown';
      
      return {
          id,
          fileData: blob,
          name: name,
          mimeType: blob.type
      };
  } catch (e) {
      console.error("Failed to get file", e);
      return undefined;
  }
};

export const deleteFile = async (id: string): Promise<void> => {
  try {
      await fetch(`/api/files/${id}`, { method: 'DELETE' });
  } catch (e) {
      console.error("Failed to delete file", e);
      throw e;
  }
};
