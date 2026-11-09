# Acer UT272 setup checklist

The board Dan should open, once this branch is what GitHub Pages is publishing:

https://dmward23-web.github.io/wardos-house-face/sheet-index.html

That URL is a static file. It does not need a Pi, a Beelink, or a private-feed service to show the home board. Cameras and lights stay hidden until a house is actually paired. Today the public site is still the older `main` commit, not this branch. Putting this tip on that URL means merging this branch to `main` (or pointing GitHub Pages at this branch) and letting Pages publish. This checklist does not do that.

The Acer is an extended display on Dan's own computer. Video is HDMI or DisplayPort. Touch is the separate USB-B cable. HDMI alone does not provide touch. Acer's page for UM.HW2AA.001: https://www.acer.com/ca-en/monitors/touch/ut2/pdp/UM.HW2AA.001

Use landscape 1920×1080, Windows or macOS scale 100%, browser zoom 100%, full screen. Portrait is not approved for this monitor.

## Windows 11

Microsoft's multiple-display page: https://support.microsoft.com/en-us/windows/hardware/display-graphics/how-to-use-multiple-monitors-in-windows

1. Connect HDMI or DisplayPort for the picture, and the USB-B cable for touch.
2. Press Windows key + P and choose Extend. Or Settings > System > Display, and under Multiple displays choose Extend.
3. Select the Acer in that Display page. Set resolution to 1920 × 1080 and scale to 100%.
4. Use Identify so you know which rectangle is the Acer. Drag the rectangles to match the desks.
5. On the Acer, open the home URL in Chrome or Edge. Press F11, or use the browser's kiosk flag if you want no address bar. The window has to be on the Acer, not the laptop screen.
6. Keep the screen awake: Settings > System > Power & battery. While plugged in, set the screen to never turn off. Confirm the exact label on that PC. Microsoft's display page above is the one this checklist is citing for Extend, resolution, and scale.

Touch on the correct screen: Microsoft's current Touch settings page (Settings > Bluetooth & devices > Touch, https://support.microsoft.com/en-us/windows/hardware/input-devices/touch-gestures-for-windows) turns gestures on. It does not document assigning a second USB touchscreen to a specific monitor. Windows still has the older tool. Search the Start menu for "Calibrate the screen for pen or touch input". If Tablet PC Settings opens, choose Setup and touch the Acer when it asks which screen is the touchscreen, then Calibrate. If that search finds nothing, touch is not mapped yet and this checklist does not invent another menu.

## macOS

Apple's Sidecar page (https://support.apple.com/en-us/102597) is an iPad used as a display. It is not this Acer.

Apple does not publish a driver for a generic USB touch monitor. Promethean's support note says macOS does not natively support external touchscreens and uses a third-party driver (UPDD): https://support.prometheanworld.com/s/article/2858

Touch-Base, the UPDD maker, says macOS does not support multi-touch devices unless their driver is installed: https://support.touch-base.com/help-articles/hardware-support/

So on a Mac, the picture can extend to the Acer (System Settings > Displays > Arrange, resolution 1920 × 1080, then the browser full screen on that display). Touch may do nothing until a third-party driver is installed, and even then it may be limited. Do not assume ten-point touch works on macOS. Check it on the actual Mac before relying on it.

To keep a Mac display awake: System Settings > Lock Screen, set "Turn display off on power adapter when inactive" to Never. That pane is the current macOS lock-screen setting; confirm the label on the Mac you are using, because Apple renames these.
