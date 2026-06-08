export default function LandingBackgroundVideo() {
  return (
    <video
      className="absolute inset-0 h-full w-full object-cover opacity-50"
      src="/assets/background%20video.mp4"
      autoPlay
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
    />
  );
}
