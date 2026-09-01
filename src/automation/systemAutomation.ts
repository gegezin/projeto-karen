import { MouseController } from './mouse/mouseController';
import { KeyboardController } from './keyboard/keyboardController';
import { ScreenController } from './screen/screenController';
import { ProcessController } from './process/processController';
import { FileController } from './files/fileController';
import { WhatsAppController } from './whatsapp/whatsappController';
import { webIntegrationController } from './web/webIntegrationController';
import { gameModeController } from './gameMode/gameModeController';

export class SystemAutomation {
  public mouse: MouseController;
  public keyboard: KeyboardController;
  public screen: ScreenController;
  public process: ProcessController;
  public files: FileController;
  public whatsapp: WhatsAppController;
  public gameMode: typeof gameModeController;
  public web: typeof webIntegrationController;

  constructor() {
    this.mouse = new MouseController();
    this.keyboard = new KeyboardController();
    this.screen = new ScreenController();
    this.process = new ProcessController();
    this.files = new FileController();
    this.whatsapp = new WhatsAppController();
    this.gameMode = gameModeController;
    this.web = webIntegrationController;
  }

  /**
   * Executa uma ação do sistema baseada em comando
   */
  async executeAction(action: string, params: any): Promise<any> {
    // Verificação básica de segurança para parâmetros
    const p = params || {};

    switch (action) {
      // Mouse
      case 'mouse_move':
        return this.mouse.moveTo(p.x, p.y);
      case 'mouse_click':
        return this.mouse.click(p.x, p.y, p.button);
      case 'mouse_double_click':
        return this.mouse.doubleClick(p.x, p.y);
      case 'mouse_right_click':
        return this.mouse.rightClick(p.x, p.y);
      case 'mouse_drag':
        return this.mouse.drag(p.fromX, p.fromY, p.toX, p.toY);
      case 'mouse_scroll':
        return this.mouse.scroll(p.amount, p.direction);
      case 'mouse_set_dpi':
        return this.mouse.setMouseDPI(p.dpi);
      case 'mouse_get_position':
        return this.mouse.getPosition();

      // Keyboard
      case 'keyboard_type':
        return this.keyboard.typeText(p.text);
      case 'keyboard_press':
        return this.keyboard.pressKey(...(p.keys || []));
      case 'keyboard_hotkey':
        return this.keyboard.hotkey(p.keys);
      case 'keyboard_copy':
        return this.keyboard.copy();
      case 'keyboard_paste':
        return this.keyboard.paste();
      case 'keyboard_cut':
        return this.keyboard.cut();
      case 'keyboard_select_all':
        return this.keyboard.selectAll();
      case 'keyboard_save':
        return this.keyboard.save();
      case 'keyboard_undo':
        return this.keyboard.undo();
      case 'keyboard_redo':
        return this.keyboard.redo();

      // Screen
      case 'screen_capture':
        return this.screen.captureScreen();
      case 'screen_capture_area':
        return this.screen.captureArea(p.x, p.y, p.width, p.height);
      case 'screen_capture_window':
        return this.screen.captureActiveWindow();
      case 'screen_get_resolution':
        return this.screen.getResolution();
      case 'screen_set_resolution':
        return this.screen.setResolution(p.width, p.height, p.refreshRate);
      case 'screen_lock':
        return this.screen.lockScreen();
      case 'screen_turn_off':
        return this.screen.turnOffDisplay();
      case 'screen_turn_on':
        return this.screen.turnOnDisplay();

      // Process
      case 'process_list':
        return this.process.listProcesses();
      case 'process_start':
        return this.process.startProgram(p.path, p.args);
      case 'process_open':
        return this.process.openProgram(p.name);
      case 'process_kill':
        return this.process.killProcess(p.pid, p.force);
      case 'process_kill_by_name':
        return this.process.killProcessByName(p.name, p.force);
      case 'process_find':
        return this.process.findProcess(p.name);
      case 'process_is_running':
        return this.process.isProcessRunning(p.name);
      case 'process_focus_window':
        return this.process.focusWindow(p.title);
      case 'process_minimize_window':
        return this.process.minimizeWindow(p.title);
      case 'process_maximize_window':
        return this.process.maximizeWindow(p.title);
      case 'process_list_windows':
        return this.process.listWindows();
      case 'system_open_url':
        return this.process.openURL(p.url);
      case 'system_execute_powershell':
        return this.process.executePowerShell(p.command);
      case 'system_execute_cmd':
        return this.process.executeCMD(p.command);

      // Files
      case 'file_read':
        return this.files.readFile(p.path);
      case 'file_find':
        return this.files.findFile(p.fileName);
      case 'file_write':
        return this.files.writeFile(p.path, p.content);
      case 'file_append':
        return this.files.appendFile(p.path, p.content);
      case 'file_edit_code':
        return this.files.editCodeFile(p.path, p.operations);
      case 'file_delete':
        return this.files.deleteFile(p.path);
      case 'file_copy':
        return this.files.copyFile(p.source, p.destination);
      case 'file_rename':
        return this.files.rename(p.oldPath, p.newPath);
      case 'file_list_directory':
        return this.files.listDirectory(p.path);
      case 'file_create_directory':
        return this.files.createDirectory(p.path);
      case 'file_delete_directory':
        return this.files.deleteDirectory(p.path, p.recursive);
      case 'file_exists':
        return this.files.fileExists(p.path);
      case 'file_search':
        return this.files.searchFiles(p.path, p.pattern);
      case 'file_search_content':
        return this.files.searchInFiles(p.path, p.term, p.extensions);
      case 'file_open_in_explorer':
        return this.files.openInExplorer(p.path);
      case 'file_compress':
        return this.files.compressFiles(p.source, p.destination);
      case 'file_extract':
        return this.files.extractArchive(p.archive, p.destination);

      // WhatsApp
      case 'whatsapp_start':
        return this.whatsapp.startWhatsApp();
      case 'whatsapp_send':
        return this.whatsapp.sendMessage(p.contact, p.message);
      case 'whatsapp_broadcast':
        return this.whatsapp.sendBroadcastMessage(p.contacts, p.message);
      case 'whatsapp_open_chat':
        return this.whatsapp.openChat(p.contact);
      case 'whatsapp_close':
        return this.whatsapp.closeWhatsApp();

      // Modo Gamer
      case 'game_mode_activate':
        return this.gameMode.activate(p.gameName, p.keepApps);
      case 'game_mode_deactivate':
        this.gameMode.deactivate();
        return true;
      case 'game_mode_status':
        return {
          active: this.gameMode.isGameModeActive(),
          currentGame: this.gameMode.getCurrentGame()
        };
      case 'game_mode_close_apps':
        return this.gameMode.closeAppsByName(p.appNames);
      case 'game_mode_get_heavy_apps':
        return this.gameMode.getRunningHeavyApps();

      // Web Integrations
      case 'web_get_weather':
        return this.web.getWeather(p.city);
      case 'web_get_currency':
        return this.web.getCurrencyRate(p.from, p.to);
      case 'web_translate':
        return this.web.translateText(p.text, p.from, p.to);

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
  }

  /**
   * Obtém informações do sistema
   */
  async getSystemInfo(): Promise<{
    resolution: { width: number; height: number };
    processes: number;
    mousePosition: { x: number; y: number };
  }> {
    const [resolution, processes, mousePosition] = await Promise.all([
      this.screen.getResolution(),
      this.process.listProcesses().then(p => p.length),
      this.mouse.getPosition()
    ]);

    return {
      resolution,
      processes,
      mousePosition
    };
  }
}
