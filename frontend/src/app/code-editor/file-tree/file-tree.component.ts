import { Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { InputDialogComponent, InputDialogData } from '@components/dialogs/input-dialog/input-dialog.component';
import { GitStatus, RepositoryFileEntry, RepositoryModel } from '@core/services/repo/repo.model';
import { AppState, Select } from '@core/store';
import { CodeEditorActions } from '@core/store/code-editor/code-edior.action';
import { CodeTab, CodeTabs } from '@core/store/code-editor/code-editor.state';
import { Store } from '@ngrx/store';
import { ComponentContainer } from 'golden-layout';
import { Subject } from 'rxjs';
import { filter, takeUntil} from 'rxjs/operators';
import { ComponentContainerInjectionToken, GlComponentDirective } from 'src/app/golden-layout';
import { fileToBase64 } from '../utils';
import { RepositoryEditService } from '@core/services/repo/repo-edit.service';
import {ITreeOptions, IActionMapping, TreeModel, TreeNode, TreeComponent, TREE_ACTIONS, KEYS} from '@circlon/angular-tree-component';
import { ConfirmDialogComponent, ConfirmDialogData } from '@components/dialogs/confirm-dialog/confirm-dialog.component';
import {getIconForFile, getIconForFolder, getIconForOpenFolder} from 'vscode-icons-ts';
import { MatMenuTrigger } from '@angular/material/menu';
import { CommonEditorService } from '../common.service';

@Component({
  selector: 'app-file-tree',
  templateUrl: './file-tree.component.html',
  styleUrls: ['./file-tree.component.scss']
})
export class FileTreeComponent extends GlComponentDirective implements OnInit,OnDestroy{
  
  private destroy$ = new Subject();


  actionMap: IActionMapping = {
    mouse:{
      click:this.onNodeClicked.bind(this),
      drop: this.onDrop.bind(this)
    },
    keys:{
      [KEYS.ENTER]: this.onNodeClicked.bind(this),
      [KEYS.RIGHT]: TREE_ACTIONS.DRILL_DOWN,
      [KEYS.LEFT]: TREE_ACTIONS.DRILL_UP,
      [KEYS.UP]: TREE_ACTIONS.PREVIOUS_NODE,
      [KEYS.DOWN]: TREE_ACTIONS.NEXT_NODE
    }
  }

  treeOptions: ITreeOptions =  {
    allowDrag:true,
    useVirtualScroll: true,
    nodeHeight: 25,
    dropSlotHeight: 5,
    allowDrop: (element, to, $event) => {
      return to.parent.hasChildren || to.parent.data.virtual;
    },
    getChildren: async (node: TreeNode) => {
      return this.sortFolderFirst(await this.editService.listDirectory(node.data.path))
    },
    hasChildrenField:'isDirectory',
    idField:'path',
    actionMapping:this.actionMap,
    animateExpand:true,
  }

  gitStatus:GitStatus;

  
  focusedTab: CodeTab = null;

  repo: RepositoryModel = null;

  files: RepositoryFileEntry[] = [];

  renamingPath: string = null;

  topLevelMenuPosition = { x: '0px', y: '0px' };

  @ViewChild('topLevelMenuAnchor',{read:MatMenuTrigger})
  topLevelMenu: MatMenuTrigger;

  @ViewChild('tree', {static:true}) tree: TreeComponent;

  private openedTabs: CodeTabs;

  constructor(private store:Store<AppState>,
              private dialog:MatDialog,
              private editService: RepositoryEditService,
              private commonService: CommonEditorService,
              @Inject(ComponentContainerInjectionToken) private container: ComponentContainer,
              elRef: ElementRef) {
                super(elRef.nativeElement)
  }

  ngOnInit(): void {
    this.container.on('resize', () => {
      console.log('resize')
      this.tree.sizeChanged();
    });
    this.store.select(Select.repofiles).pipe(
      takeUntil(this.destroy$),
      filter<RepositoryFileEntry[]>(Boolean)
    ).subscribe((files) => {
      this.files = this.sortFolderFirst(files);
    });

    this.store.select(Select.openCodeTabs).pipe(
      takeUntil(this.destroy$)
    ).subscribe((tabs) => {
      this.openedTabs = tabs;
    });
    this.store.select(Select.focusedCodeTab).pipe(
      takeUntil(this.destroy$)
    ).subscribe((tab) => {
      this.focusedTab = tab;
    });

    this.store.select(Select.gitStatus).pipe(
      takeUntil(this.destroy$)
    ).subscribe((status) => {
      this.gitStatus = status;
    });

    this.store.select(Select.editingRepo).pipe(
      takeUntil(this.destroy$)
    ).subscribe((repo) => {
      this.repo = repo;
    })
  }
  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

  getIconForNode(node: TreeNode) {
    if (!node.data.isDirectory) {
      return getIconForFile(node.data.name)
    }
    if (node.isExpanded) {
      return getIconForOpenFolder(node.data.name)
    }
    return getIconForFolder(node.data.name)
  }

  private sortFolderFirst(data:RepositoryFileEntry[]) : RepositoryFileEntry[] {
    return data.sort((a,b) => {
      return a.isDirectory ? -1 : 1
    })
  }

  onNodeClicked(tree: TreeModel, node: TreeNode, $event: any, ...rest: any[]) {
    if ($event.shiftKey) {
      return TREE_ACTIONS.TOGGLE_ACTIVE_MULTI(tree,node,$event);
    }

    if (node.data.isDirectory) {
      TREE_ACTIONS.TOGGLE_EXPANDED(tree, node, $event);
      return
    }

    if(!this.openedTabs || !(node.data.path in this.openedTabs))
      this.store.dispatch(CodeEditorActions.OpenTab({tab:node.data as any}))
    this.store.dispatch(CodeEditorActions.FocusTab({tab:node.data as any}));
  }

  async onDrop(tree: TreeModel, node: TreeNode, $event: DragEvent, {from, to}: {from: TreeNode, to: TreeNode}) {
    if (!from) {
      this.handleOutsideDrop(tree,$event,to);
      return;
    }
    let copy = $event.ctrlKey;
    const activeNodes = tree.getActiveNodes();
    const fileCount = activeNodes.length > 0 ? activeNodes.length : 1
    if (!copy) {
      const result = await this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, string>(ConfirmDialogComponent, {
        data:{
          title:'Move',
          message:`Are you sure you want to move ${fileCount} file${fileCount > 1 ? 's': ''}?`,
          submitButton:`Move ${fileCount} file${fileCount > 1 ? 's': ''}`,
          color:'warn',
          extraActions:[{
            button:`Copy ${fileCount} file${fileCount > 1 ? 's': ''}`,
            value:'COPY',
            color:'primary'
          }]
        }
      }).afterClosed().toPromise()
      if (!result) return;
      copy = result === 'COPY'
    }
    const toPath = !to?.parent?.data?.virtual ? to.parent.data.path : '';
    if (activeNodes.length > 1) {
      activeNodes.forEach((item) => {
        if (copy)
          this.copyFile(item.data.path, toPath)
        else
          this.moveFile(item.data.path, toPath)
      })
    } else {
      if (copy)
        this.copyFile(from.data.path, toPath)
      else
        this.moveFile(from.data.path, toPath)
    } 
    
  }

  async handleOutsideDrop(tree: TreeModel, $event: DragEvent, to: TreeNode) {
    $event.preventDefault();
    $event.stopPropagation();
    const toPath = !to?.parent?.data?.virtual ? to.parent.data.path : '/';

    const files = $event.dataTransfer.files;

    if(!files || files.length === 0) return;

    for(const file of Array.from(files)) {
        const path = toPath === '/' ? file.name : `${toPath}/${file.name}`
        this.commonService.uploadFile(this.repo.id, path, file);
    }
  }

  onRename(tree: TreeModel, node: TreeNode, $event: any)  {
    this.renamingPath = node.data.path;
  }

  onRun(tree: TreeModel, node: TreeNode, $event: any)  {
    this.store.dispatch(CodeEditorActions.StartProcess({params:{path:node.data.path}}));
  }

  async onMove(tree: TreeModel, node: TreeNode, $event: any) {
    const activeNodes = tree.getActiveNodes();
    const toFolder = await this.dialog.open<InputDialogComponent,InputDialogData,string>(InputDialogComponent,{
      data:{ 
        title:'To folder',
        inputLabel:'Folder',
        submitButton:'Move',
        hint:'dir/subdir',
        inputPrefix:'/'
      }
    }).afterClosed().toPromise();

    if (!toFolder) return;

    if (activeNodes.length === 0) {
      this.moveFile(node.data.path, toFolder);
    } else {
      for(const activeNode of activeNodes) {
        try {
          this.moveFile(activeNode.data.path, toFolder);
          activeNode.setIsActive(false);
        } catch(e) {
          console.warn(e)
        } 
      }
    }
  }

  async onDelete(tree: TreeModel, node: TreeNode, $event: any) {
    const activeNodes = tree.getActiveNodes();
    if (activeNodes.length === 0) {
      await this.commonService.deleteFiles([node.data.path])
    }
    else {
      await this.commonService.deleteFiles(activeNodes.map(n => n.data.path));
    }
  }

  onNewFile(tree?: TreeModel, node?: TreeNode, $event?: any) {
    const parentPath = node?.data?.path || '/';
    if (node)
      node.expand()
    this.newFileForFolder(parentPath)
  }

  onNewFolder(tree?: TreeModel, node?: TreeNode, $event?: any) {
    const parentPath = node?.data?.path || '/';
    if (node)
      node.expand()
    this.newFolderForFolder(parentPath);
  }

  stopRenaming() {
    this.renamingPath = null;
  }

  isGitDirty(path:string) {

    if(!this.gitStatus) return false;

    if (path in this.gitStatus) return true;

    for (const key in this.gitStatus) {
      if (key.startsWith(path)) {
      return true;
      }
    }
    return false;
  }

  async newFileForFolder(folderPath:string) {
      try {
        let path = ''
        if (folderPath !== '/')
          path = await this.editService.createFile(`${folderPath}/unnamed`,'',false)
        else
          path = await this.editService.createFile(`unnamed`,'',false)
        this.renamingPath = path
      } catch(e) {
        console.error(e)
      }
  }

  async newFolderForFolder(folderPath:string) {
    try {
      let path = ''
      if (folderPath !== '/')
        path = await this.editService.makeDir(`${folderPath}/unnamed`)
      else
        path = await this.editService.makeDir(`unnamed`)
      this.renamingPath = path
    } catch(e) {
      console.error(e)
    }
  }

  openInNewTab(node: TreeNode) {
    this.store.dispatch(CodeEditorActions.OpenTab({tab:node.data as any}))
  }

  onDownload(node: TreeNode) {
    const path = node.data.path;

    this.commonService.downloadFile(this.repo.id, path);
  }

  close() {
    this.container.close();
  }

  async renameFile(path:string, newName: string) {

    const dirname = path.substring(0,path.lastIndexOf("/")+1);

    try {
      await this.editService.moveFile(path,dirname ? `${dirname}/${newName}` : newName)
    } catch(e) {
      console.warn(e)
    }
    if (path in this.openedTabs) {
      this.store.dispatch(CodeEditorActions.CloseTab({
        tab:this.openedTabs[path]
      }))
    }
  }

  async moveFile(path:string,to: string) {
    const filename = path.substring(path.lastIndexOf('/')+1);
    try {
      await this.editService.moveFile(path,to !== '' ? `${to}/${filename}` : filename )
    } catch(e) {
      console.warn(e)
    }
  }

  async copyFile(from: string, to: string) {
    try {
      await this.editService.copyFile(from, to);
    } catch(e) {
      console.warn(e)
    }
  }

  onTopLevelMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.topLevelMenuPosition.x = event.clientX + 'px';
    this.topLevelMenuPosition.y = event.clientY + 'px';
    this.topLevelMenu.menu.focusFirstItem('mouse');
    this.topLevelMenu.openMenu();
  }

  focus(): void {
    this.tree?.treeModel?.setFocus(true);
    this.tree?.treeModel.getFirstRoot().focus(true);
  }

  blur(): void {
    this.tree?.treeModel.getFocusedNode().blur();
    this.tree?.treeModel?.setFocus(false);
  }
}
