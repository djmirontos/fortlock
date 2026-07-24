import { useState, useEffect } from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

interface ServiceLogoProps {
  serviceName: string;
  size?: number;
}

const getDomain = (name: string): string => {
  const domains: Record<string, string> = {
    // Philippine Banks
    "banco de oro": "bdo.com.ph",
    "bdo unibank": "bdo.com.ph",
    bdo: "bdo.com.ph",
    "bank of the philippine islands": "bpi.com.ph",
    bpi: "bpi.com.ph",
    "metropolitan bank": "metrobank.com.ph",
    metrobank: "metrobank.com.ph",
    "union bank": "unionbankph.com",
    unionbank: "unionbankph.com",
    "land bank": "lbp.com.ph",
    landbank: "lbp.com.ph",
    "philippine national bank": "pnb.com.ph",
    pnb: "pnb.com.ph",
    rcbc: "rcbc.com",
    "security bank": "securitybank.com",
    chinabank: "chinabank.ph",
    eastwest: "eastwestbanker.com",
    // Digital Wallets & Payment
    gcash: "gcash.com",
    maya: "maya.ph",
    paymaya: "maya.ph",
    grab: "grab.com",
    grabpay: "grab.com",
    shopee: "shopee.ph",
    shopeepay: "shopee.ph",
    lazada: "lazada.com.ph",
    paypal: "paypal.com",
    stripe: "stripe.com",
    // Email & Social
    gmail: "google.com",
    google: "google.com",
    facebook: "facebook.com",
    instagram: "instagram.com",
    twitter: "twitter.com",
    x: "x.com",
    tiktok: "tiktok.com",
    youtube: "youtube.com",
    reddit: "reddit.com",
    twitch: "twitch.tv",
    // Streaming & Entertainment
    netflix: "netflix.com",
    spotify: "spotify.com",
    disney: "disneyplus.com",
    hbo: "hbomax.com",
    // Tech & Productivity
    apple: "apple.com",
    icloud: "apple.com",
    microsoft: "microsoft.com",
    outlook: "microsoft.com",
    hotmail: "microsoft.com",
    yahoo: "yahoo.com",
    github: "github.com",
    linkedin: "linkedin.com",
    discord: "discord.com",
    slack: "slack.com",
    notion: "notion.so",
    dropbox: "dropbox.com",
    zoom: "zoom.us",
    // Design & Creativity
    canva: "canva.com",
    figma: "figma.com",
    // Shopping & Commerce
    amazon: "amazon.com",
    // Gaming
    steam: "steampowered.com",
  };

  const key = name.toLowerCase().trim();
  for (const [k, v] of Object.entries(domains)) {
    if (key.includes(k)) return v;
  }
  return "";
};

const getColorForInitial = (char: string): string => {
  const code = char.charCodeAt(0) % 6;
  const colors = ["#4F6FFF", "#EA4335", "#1877F2", "#1DB954", "#FF6B35", "#8B5CF6"];
  return colors[code];
};

export default function ServiceLogo({ serviceName, size = 48 }: ServiceLogoProps) {
  const [logoState, setLogoState] = useState<"placeholder" | "cached">("placeholder");
  const [logoUri, setLogoUri] = useState<string>("");
  const [domain, setDomain] = useState<string>("");

  useEffect(() => {
    const loadLogo = async () => {
      const foundDomain = getDomain(serviceName);
      setDomain(foundDomain);

      if (!foundDomain) {
        setLogoState("placeholder");
        return;
      }

      const cacheFileName = `logo_${foundDomain.replace(/\./g, "_")}.png`;
      const cachePath = `${FileSystem.cacheDirectory}${cacheFileName}`;

      try {
        // Check if cached
        const info = await FileSystem.getInfoAsync(cachePath);
        if (info.exists) {
          console.log("Using cached logo for:", serviceName);
          setLogoUri(cachePath);
          setLogoState("cached");
          return;
        }

        // Not cached, show placeholder and download in background
        setLogoState("placeholder");

        // Background download from Clearbit
        const clearbitUrl = `https://logo.clearbit.com/${foundDomain}`;
        try {
          console.log("Downloading logo from Clearbit:", serviceName);
          const result = await FileSystem.downloadAsync(clearbitUrl, cachePath);
          if (result.status === 200) {
            console.log("Cached Clearbit logo for:", serviceName);
            setLogoUri(cachePath);
            setLogoState("cached");
            return;
          }
        } catch (clearbitError) {
          console.log("Clearbit failed for:", serviceName, "- trying Google favicon");
        }

        // Fallback to Google Favicon
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${foundDomain}&sz=128`;
        try {
          const result = await FileSystem.downloadAsync(faviconUrl, cachePath);
          if (result.status === 200) {
            console.log("Cached Google favicon for:", serviceName);
            setLogoUri(cachePath);
            setLogoState("cached");
            return;
          }
        } catch (faviconError) {
          console.log("Google favicon failed for:", serviceName, "- using placeholder");
        }

        // Both failed, stay on placeholder
        setLogoState("placeholder");
      } catch (error) {
        console.log("Logo load error for:", serviceName, error);
        setLogoState("placeholder");
      }
    };

    loadLogo();
  }, [serviceName]);

  const bgColor = getColorForInitial(serviceName[0]);
  const borderRadius = size / 4;

  // Show cached logo
  if (logoState === "cached" && logoUri) {
    return (
      <View style={[styles.logoContainer, { width: size, height: size, borderRadius }]}>
        <Image
          source={{ uri: logoUri }}
          style={[
            styles.logoImage,
            {
              width: size - 8,
              height: size - 8,
              borderRadius: borderRadius - 1,
            },
          ]}
          resizeMode="contain"
        />
      </View>
    );
  }

  // Show placeholder
  return (
    <View
      style={[
        styles.placeholder,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>
        {serviceName[0].toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    resizeMode: "contain",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});
