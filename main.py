# main.py
# -*- coding: utf-8 -*-
import customtkinter as ctk
from ui import NovelGeneratorGUI

def main():
    # 解决 Windows High-DPI 缩放可能导致的高频重绘与 CPU 占用过高的问题
    try:
        ctk.deactivate_automatic_dpi_awareness()
    except Exception:
        pass

    app = ctk.CTk()

    # 锁定缩放因子为 1.0，防止某些系统下的高频缩放微调导致 CPU 飙升
    try:
        ctk.set_widget_scaling(1.0)
        ctk.set_window_scaling(1.0)
    except Exception:
        pass

    gui = NovelGeneratorGUI(app)
    app.mainloop()

if __name__ == "__main__":
    main()

