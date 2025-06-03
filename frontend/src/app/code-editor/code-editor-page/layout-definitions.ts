import type { TopLevelMenuItem } from "@material/menu-bar/menu-bar.component";
import { ToolBarItem } from "@material/tool-bar/tool-bar.component";
import type { LayoutConfig,} from "golden-layout";
import { ItemType,LayoutManager } from "golden-layout";

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
    dimensions: {
        borderWidth: 5,
        minItemHeight: 10,
        minItemWidth: 10,
        headerHeight: 20,
        dragProxyWidth: 300,
        dragProxyHeight: 200
    },
    header:{
        popout:false,
    },
    root: {
        type: ItemType.row,
        width:100,
        isClosable:false,
        content: [
            {
                type:ItemType.column,
                width:10,
                isClosable:false,
                content:[]
            },
            {
                type: ItemType.row,
                width:90,
                isClosable:false,
                content: [
                    {
                        type:ItemType.column,
                        width:100,
                        isClosable:false,
                        content:[]
                    }
                ]
            },
        ]
    }
}

export const MENU_BAR: TopLevelMenuItem[] = [
    {
        title: 'File',
        children: [
            {
                title: 'New File',
                id: 'NEW_FILE',
                keybind: 'alt + n'
            },
            {
                title: 'New Folder',
                id: 'NEW_FOLDER',
                keybind: 'alt + n + f'
            },
            {
                divider:true
            },
            {
                title: 'Save Files',
                id: 'SAVE_FILES',
                keybind: 'ctrl + alt + s'
            },
            {
                title: 'Upload file',
                id: 'UPLOAD_FILE',
                keybind: 'alt + u'
            }
        ]
    },
    {
        title: 'Edit',
        children: [
            {
                title: 'Undo',
                id: 'UNDO',
                keybind:'ctrl + z',
                dontBind:true
            },
            {
                title: 'Redo',
                id: 'REDO',
                keybind:'ctrl + y',
                dontBind:true
            },
            {
                divider: true
            },
            {
                title: 'Find',
                id:'FIND',
                keybind:'ctrl + f',
                dontBind:true,
            },
            {
                title: 'Replace',
                id:'REPLACE',
                keybind:'ctrl + h',
                dontBind:true
            }
        ]
    },
    {
        title:'Project',
        children:[
            {
                title:'Run',
                keybind:'f9',
                id:'RUN'
            },
            {
                title:'Build',
                id:'BUILD',
                keybind:'ctrl + b'
            },
            {
                title:'Stop',
                id:'STOP',
                keybind:'ctrl + f9'
            },
            {
                divider:true
            },
            {
                title:'Open Terminal',
                id:'OPEN_TERMINAL',
                keybind:'alt + t'
            },
            {
                divider:true
            },
            {
                title:'Commit',
                keybind:'alt + c',
                id:'COMMIT'
            }
        ]
    },
    {
        title: 'View',
        children: [
            {
                title: 'Show top bar',
                checkbox: true,
                checked: true,
                id: 'SHOW_TOP_BAR'
            },
            {
                title: 'Show Toolbar',
                checkbox: true,
                checked: true,
                id: 'SHOW_TOOL_BAR'
            },
            {
                divider:true
            },
            {
                title:'Panels',
                children:[
                    {
                        title:'Show file tree',
                        checkbox:true,
                        checked:true,
                        id:'SHOW_FILE_TREE'
                    },
                    {
                        title:'Show Running',
                        checkbox:true,
                        checked:false,
                        id:'SHOW_RUNNING'
                    }
                ]
            }
        ]
    }
]