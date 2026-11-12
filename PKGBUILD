
pkgname=remder
pkgver=1.0.1
pkgrel=1
pkgdesc="Render your markdown with tons of bells and whistles!"
arch=('x86_64' 'aarch64') 
url="https://github.com/Keyboard1000n17/remder"
license=('GPL-3.0-or-later')
source_x86_64=("remder::https://github.com/Keyboard1000n17/remder/releases/download/remder-v${pkgver}/remder-linux-x64")
source_aarch64=("remder::https://github.com/Keyboard1000n17/remder/releases/download/remder-v${pkgver}/remder-linux-arm64")
sha256sums_x86_64=('d99ceeacefa214f86561384f315fd3c1f9b24fb0283a5dadd9b4acecc5a1cfcb')
sha256sums_aarch64=('13afcb79363bd5b6076ac5392d4bedb0ce8c0a5df26ecbd02843671d72ad3c9b')

package() {
  install -Dm775 "$srcdir/remder" "$pkgdir/usr/bin/remder"
}
