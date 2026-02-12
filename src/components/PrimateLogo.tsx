import wanprcLogo from "@/assets/wanprc-logo.png";

interface PrimateLogoProps {
  className?: string;
}

export function PrimateLogo({ className = "h-6 w-6" }: PrimateLogoProps) {
  return (
    <img
      src={wanprcLogo}
      alt="WaNPRC Logo"
      className={`${className} rounded-full object-cover`}
    />
  );
}
