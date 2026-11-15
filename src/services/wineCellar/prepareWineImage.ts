import {
  WINE_PHOTO_MAX_BYTES,
  WINE_PHOTO_MAX_SIDE,
  WINE_PHOTO_MIME_TYPE,
  WINE_PHOTO_MIN_SIDE,
  type WineImage,
} from "@/contracts/wineCellar";

/* =========================
   Préparation d'une photo d'étiquette avant l'envoi

   Contrat : ../Backend/docs/wine-cellar-contract.md, § 3
   (« Photo d'un vin (W7) »). Quelle que soit la source
   (fichier, photothèque, appareil photo de l'iPad ; JPEG,
   PNG, HEIC si le navigateur le lit) :
   - image décodée par le navigateur, qui applique
     l'orientation EXIF : les pixels redessinés sont dans le
     bon sens (le Mac ne lit pas l'orientation) ;
   - grand côté ramené à WINE_PHOTO_MAX_SIDE au plus ;
   - JPEG de WINE_PHOTO_MAX_BYTES au plus : qualité baissée
     par paliers, puis dimensions réduites si cela ne
     suffit pas ;
   - petit côté de WINE_PHOTO_MIN_SIDE au moins, sinon refus
     avant l'envoi (le Mac refuserait toute la saisie).
   Les erreurs ont un message lisible, affiché tel quel.
========================= */

const QUALITIES = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5];

const SHRINK_FACTOR = 0.8;

export interface PreparedWineImage {
  image: WineImage;

  /* Aperçu (URL d'objet) : à libérer par l'appelant. */
  previewUrl: string;
}

function loadImage(
  file: Blob
): Promise<HTMLImageElement> {
  const url =
    URL.createObjectURL(file);

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img =
      new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          "This image cannot be read here. Use a JPEG or PNG file."
        )
      );
    };

    img.src = url;
  });
}

function toJpeg(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob =>
        blob
          ? resolve(blob)
          : reject(new Error("Unable to convert the image to JPEG.")),
      WINE_PHOTO_MIME_TYPE,
      quality
    );
  });
}

function draw(
  img: HTMLImageElement,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas =
    document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to prepare the image.");
  }

  /* Fond blanc : le JPEG n'a pas de transparence (PNG). */
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = "high";
  context.drawImage(img, 0, 0, width, height);

  return canvas;
}

function toBase64(
  blob: Blob
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader =
      new FileReader();

    reader.onload = () => {
      const dataUrl =
        String(reader.result);

      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };

    reader.onerror = () =>
      reject(new Error("Unable to encode the image."));

    reader.readAsDataURL(blob);
  });
}

export async function prepareWineImage(
  file: Blob
): Promise<PreparedWineImage> {
  const img =
    await loadImage(file);

  /* Dimensions après orientation EXIF. */
  const sourceWidth =
    img.naturalWidth;

  const sourceHeight =
    img.naturalHeight;

  if (Math.min(sourceWidth, sourceHeight) < WINE_PHOTO_MIN_SIDE) {
    throw new Error(
      `Image of ${sourceWidth} x ${sourceHeight} px, ` +
      `${WINE_PHOTO_MIN_SIDE} px at least.`
    );
  }

  let scale =
    Math.min(1, WINE_PHOTO_MAX_SIDE / Math.max(sourceWidth, sourceHeight));

  for (;;) {
    const width =
      Math.round(sourceWidth * scale);

    const height =
      Math.round(sourceHeight * scale);

    if (Math.min(width, height) < WINE_PHOTO_MIN_SIDE) {
      throw new Error("This image cannot be reduced to 1 MB.");
    }

    const canvas =
      draw(img, width, height);

    for (const quality of QUALITIES) {
      const blob =
        await toJpeg(canvas, quality);

      if (blob.size <= WINE_PHOTO_MAX_BYTES) {
        return {
          image: {
            mimeType: WINE_PHOTO_MIME_TYPE,
            width,
            height,
            data: await toBase64(blob),
          },
          previewUrl: URL.createObjectURL(blob),
        };
      }
    }

    scale *= SHRINK_FACTOR;
  }
}
