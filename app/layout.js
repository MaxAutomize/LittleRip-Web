import './globals.css'

export const metadata = {
  title: 'LittleRip',
  description: 'LittleRip — cloud chat, voice, and the Inner Monologue Loop',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Imperial+Script&family=Pinyon+Script&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Blurred background slideshow */}
        <div className="bg-slideshow" aria-hidden="true">
          <img src="/bg/img1.jpg" alt="" />
          <img src="/bg/img2.jpg" alt="" />
          <img src="/bg/img3.jpg" alt="" />
        </div>
        {children}
      </body>
    </html>
  )
}