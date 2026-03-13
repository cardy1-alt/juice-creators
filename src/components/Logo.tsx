interface LogoProps {
  size?: number;
  color?: string;
}

export function Logo({ size = 40, color = "#1A3C34" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="42,61 81,100 42,139 3,100" fill={color}/>
      <polygon points="61,42 100,3 139,42 100,81" fill={color}/>
      <polygon points="158,61 197,100 158,139 119,100" fill={color}/>
      <polygon points="61,119 100,158 139,119 100,158" fill={color}/>
    </svg>
  )
}
