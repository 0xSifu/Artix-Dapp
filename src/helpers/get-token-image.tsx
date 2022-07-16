import TimeImg from "../assets/tokens/TIME.svg";
import MemoImg from "../assets/tokens/MEMO.png";
import SartixImg from "../assets/tokens/sartix-old.png";
import ArtixImg from "../assets/tokens/artix-new.png";

function toUrl(tokenPath: string): string {
    const host = window.location.origin;
    return `${host}/${tokenPath}`;
}

export function getTokenUrl(name: string) {
    if (name === "artix") {
        return toUrl(ArtixImg);
    }

    if (name === "sartix") {
        return toUrl(SartixImg);
    }

    throw Error(`Token url doesn't support: ${name}`);
}
