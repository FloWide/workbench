import { CodeEditorEffects } from "./code-editor/code-editor.effect";
import { PlatformServiceEffects } from "./platform-service/platform-service.effect";
import { PythonServiceEffects } from "./python-service/python-service.effect";
import { RepositoryEffects } from "./repo/repo.effect";
import { ScriptEffects } from "./script/script.effect";
import { UserEffects } from "./user/user.effect";




export const APP_EFFECTS = [
    ScriptEffects,
    RepositoryEffects,
    PythonServiceEffects,
    CodeEditorEffects,
    UserEffects,
    PlatformServiceEffects
]