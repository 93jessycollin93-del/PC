/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * LZW Compression and Decompression suite for Cybernetic OS.
 * Compresses large text files (e.g. source code) into safe, highly compact Base64 strings.
 */

// Helper to convert array of 16-bit integers to Uint8Array (splitting into low and high bytes)
function uint16ArrayToUint8Array(uint16Arr: number[]): Uint8Array {
    const uint8Arr = new Uint8Array(uint16Arr.length * 2);
    for (let i = 0; i < uint16Arr.length; i++) {
        const val = uint16Arr[i];
        uint8Arr[i * 2] = val & 0xff;          // Low byte
        uint8Arr[i * 2 + 1] = (val >> 8) & 0xff; // High byte
    }
    return uint8Arr;
}

// Helper to convert Uint8Array back to an array of 16-bit integers
function uint8ArrayToUint16Array(uint8Arr: Uint8Array): number[] {
    const uint16Arr: number[] = [];
    for (let i = 0; i < uint8Arr.length; i += 2) {
        const low = uint8Arr[i];
        const high = i + 1 < uint8Arr.length ? uint8Arr[i + 1] : 0;
        uint16Arr.push(low | (high << 8));
    }
    return uint16Arr;
}

// Helper to convert Uint8Array to a standard Base64 string safely
function uint8ArrayToBase64(uint8Arr: Uint8Array): string {
    let binary = '';
    const len = uint8Arr.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Arr[i]);
    }
    return btoa(binary);
}

// Helper to convert a standard Base64 string back to Uint8Array safely
function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Compresses any UTF-8 string into a compact Base64 string using LZW
 */
export function compressToLZWBase64(uncompressed: string): string {
    if (!uncompressed) return "";
    
    const dictionary: { [key: string]: number } = {};
    for (let i = 0; i < 256; i++) {
        dictionary[String.fromCharCode(i)] = i;
    }

    let word = "";
    const result: number[] = [];
    let dictSize = 256;

    for (let i = 0; i < uncompressed.length; i++) {
        const char = uncompressed[i];
        const wordChar = word + char;
        if (wordChar in dictionary) {
            word = wordChar;
        } else {
            result.push(dictionary[word]);
            // Limit dictionary size to 65535 to fit in 16-bit integers
            if (dictSize < 65535) {
                dictionary[wordChar] = dictSize++;
            }
            word = char;
        }
    }

    if (word !== "") {
        result.push(dictionary[word]);
    }

    const uint8Arr = uint16ArrayToUint8Array(result);
    return uint8ArrayToBase64(uint8Arr);
}

/**
 * Decompresses an LZW-compressed Base64 string back to its original text
 */
export function decompressFromLZWBase64(base64: string): string {
    if (!base64) return "";
    
    const uint8Arr = base64ToUint8Array(base64);
    const codes = uint8ArrayToUint16Array(uint8Arr);
    
    if (codes.length === 0) return "";

    const dictionary: { [key: number]: string } = {};
    for (let i = 0; i < 256; i++) {
        dictionary[i] = String.fromCharCode(i);
    }

    let word = String.fromCharCode(codes[0]);
    let result = word;
    let dictSize = 256;

    for (let i = 1; i < codes.length; i++) {
        const code = codes[i];
        let entry = "";
        
        if (code in dictionary) {
            entry = dictionary[code];
        } else if (code === dictSize) {
            entry = word + word[0];
        } else {
            throw new Error(`LZW decompression error: code ${code} not in dictionary (max dict: ${dictSize})`);
        }

        result += entry;
        
        if (dictSize < 65535) {
            dictionary[dictSize++] = word + entry[0];
        }
        word = entry;
    }

    return result;
}

/**
 * Quick LZ77 / Run-Length combination compressor (fallback/alternative)
 */
export function simpleRLECompress(text: string): string {
    if (!text) return "";
    let result = "";
    let count = 1;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === text[i + 1]) {
            count++;
        } else {
            result += (count > 3 ? `~${count}${text[i]}` : text[i].repeat(count));
            count = 1;
        }
    }
    return result;
}

export function simpleRLEDecompress(compressed: string): string {
    if (!compressed) return "";
    let result = "";
    let i = 0;
    while (i < compressed.length) {
        if (compressed[i] === '~') {
            i++;
            let countStr = "";
            while (compressed[i] >= '0' && compressed[i] <= '9') {
                countStr += compressed[i];
                i++;
            }
            const count = parseInt(countStr, 10);
            const char = compressed[i];
            result += char.repeat(count);
            i++;
        } else {
            result += compressed[i];
            i++;
        }
    }
    return result;
}

/**
 * Compresses a UTF-8 string to a Gzip Base64 string using the browser's native CompressionStream
 */
export async function compressToGzipBase64(text: string): Promise<string> {
    if (!text) return "";
    const stream = new Blob([new TextEncoder().encode(text)]).stream();
    const gzipStream = stream.pipeThrough(new CompressionStream("gzip"));
    const response = new Response(gzipStream);
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    return uint8ArrayToBase64(new Uint8Array(buffer));
}

/**
 * Decompresses a Gzip Base64 string back to its original UTF-8 string using the browser's native DecompressionStream
 */
export async function decompressFromGzipBase64(base64: string): Promise<string> {
    if (!base64) return "";
    const bytes = base64ToUint8Array(base64);
    const stream = new Blob([bytes]).stream();
    const gunzipStream = stream.pipeThrough(new DecompressionStream("gzip"));
    const response = new Response(gunzipStream);
    const text = await response.text();
    return text;
}

