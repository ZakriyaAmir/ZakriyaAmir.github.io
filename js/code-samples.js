(function(){const s=[{id:"object-pool",t:"Object pool",d:"A generic pool that re-uses objects instead of Instantiate/Destroy, to avoid GC spikes on mobile.",file:"ObjectPool.cs",code:`using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// A small generic object pool. Re-using instances instead of calling
/// Instantiate/Destroy every frame avoids GC spikes and frame hitches on mobile.
/// </summary>
public class ObjectPool<T> where T : Component
{
    private readonly T prefab;
    private readonly Transform parent;
    private readonly Stack<T> inactive = new Stack<T>();

    public int CountInactive => inactive.Count;

    public ObjectPool(T prefab, int prewarm = 0, Transform parent = null)
    {
        this.prefab = prefab;
        this.parent = parent;

        // Create a few instances up front (e.g. during a loading screen).
        for (int i = 0; i < prewarm; i++)
            Release(Object.Instantiate(prefab, parent));
    }

    /// <summary>Takes an instance from the pool, or creates one if the pool is empty.</summary>
    public T Get(Vector3 position, Quaternion rotation)
    {
        T item = inactive.Count > 0 ? inactive.Pop() : Object.Instantiate(prefab, parent);
        item.transform.SetPositionAndRotation(position, rotation);
        item.gameObject.SetActive(true);
        return item;
    }

    /// <summary>Returns an instance to the pool instead of destroying it.</summary>
    public void Release(T item)
    {
        item.gameObject.SetActive(false);
        inactive.Push(item);
    }
}

// Usage: a weapon that fires pooled projectiles (Projectile is your own MonoBehaviour that calls onFinished when it hits or times out).
public class Blaster : MonoBehaviour
{
    [SerializeField] private Projectile projectilePrefab;
    private ObjectPool<Projectile> pool;

    private void Awake() => pool = new ObjectPool<Projectile>(projectilePrefab, prewarm: 20);

    public void Fire()
    {
        Projectile p = pool.Get(transform.position, transform.rotation);
        p.Launch(onFinished: () => pool.Release(p)); // the projectile reports back when it is done
    }
}
`},{id:"state-machine",t:"State machine",d:"A tiny finite state machine with condition-based transitions, shown driving a patrol/chase enemy.",file:"StateMachine.cs",code:`using System;
using System.Collections.Generic;
using UnityEngine;

/// <summary>One state of a state machine: it gets told when it starts, updates and ends.</summary>
public interface IState
{
    void Enter();
    void Tick(float deltaTime);
    void Exit();
}

/// <summary>
/// A minimal finite state machine. Transitions are plain conditions checked every tick,
/// so each state stays small and knows nothing about the others.
/// </summary>
public class StateMachine
{
    private readonly Dictionary<IState, List<(Func<bool> when, IState to)>> transitions = new();
    public IState Current { get; private set; }

    public void AddTransition(IState from, IState to, Func<bool> when)
    {
        if (!transitions.TryGetValue(from, out var list))
            transitions[from] = list = new List<(Func<bool>, IState)>();
        list.Add((when, to));
    }

    public void SetState(IState next)
    {
        if (next == Current) return;
        Current?.Exit();
        Current = next;
        Current.Enter();
    }

    public void Tick(float deltaTime)
    {
        // The first transition whose condition is true wins.
        if (Current != null && transitions.TryGetValue(Current, out var list))
            foreach (var (when, to) in list)
                if (when()) { SetState(to); break; }

        Current?.Tick(deltaTime);
    }
}

// Usage: an enemy that patrols until the player gets close, then chases.
public class Enemy : MonoBehaviour
{
    [SerializeField] private Transform player;
    [SerializeField] private float sightRange = 8f;
    private readonly StateMachine fsm = new StateMachine();

    private void Awake()
    {
        var patrol = new PatrolState(transform);
        var chase = new ChaseState(transform, player);

        bool PlayerNear() => Vector3.Distance(transform.position, player.position) < sightRange;
        fsm.AddTransition(patrol, chase, PlayerNear);
        fsm.AddTransition(chase, patrol, () => !PlayerNear());
        fsm.SetState(patrol);
    }

    private void Update() => fsm.Tick(Time.deltaTime);
}

// Two small states. Each one only knows how to do its own job.
public class PatrolState : IState
{
    private readonly Transform self;
    public PatrolState(Transform self) => this.self = self;

    public void Enter() { }
    public void Tick(float dt) { self.Rotate(0f, 45f * dt, 0f); self.Translate(Vector3.forward * dt); }
    public void Exit() { }
}

public class ChaseState : IState
{
    private readonly Transform self, target;
    public ChaseState(Transform self, Transform target) { this.self = self; this.target = target; }

    public void Enter() { }
    public void Tick(float dt)
    {
        self.LookAt(target);
        self.position = Vector3.MoveTowards(self.position, target.position, 3f * dt);
    }
    public void Exit() { }
}
`},{id:"save-system",t:"Save system",d:"A versioned JSON save system that writes safely, so a crash mid-save can't corrupt the player's progress.",file:"SaveSystem.cs",code:`using System;
using System.IO;
using UnityEngine;

/// <summary>Everything we persist. Keep it a plain serializable class so it is easy to version.</summary>
[Serializable]
public class SaveData
{
    public int version = 1;     // bump when the format changes, then migrate old files in Load()
    public int coins;
    public int highestLevel;
    public bool musicOn = true;
}

/// <summary>
/// JSON save system. Writes to a temp file first and then swaps it in, so a crash or a
/// killed app mid-write never leaves the player with a corrupted save.
/// </summary>
public static class SaveSystem
{
    private static string FilePath => Path.Combine(Application.persistentDataPath, "save.json");

    public static void Save(SaveData data)
    {
        string json = JsonUtility.ToJson(data);
        string temp = FilePath + ".tmp";

        File.WriteAllText(temp, json);
        if (File.Exists(FilePath)) File.Delete(FilePath);
        File.Move(temp, FilePath);
    }

    public static SaveData Load()
    {
        try
        {
            if (!File.Exists(FilePath)) return new SaveData(); // first launch
            var data = JsonUtility.FromJson<SaveData>(File.ReadAllText(FilePath));
            return data ?? new SaveData();
        }
        catch (Exception e)
        {
            // Never block the game on a bad file: log it and start fresh.
            Debug.LogWarning($"Save file unreadable, starting a new one: {e.Message}");
            return new SaveData();
        }
    }
}

// Usage
// var save = SaveSystem.Load();
// save.coins += 50;
// SaveSystem.Save(save);
`}],r=e=>document.querySelector(e),a=r("#codeTabs"),m=r("#codeBox");if(!a||!m)return;const l=e=>e.replace(/[&<>]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[t]),f=new Set("using public private protected internal static readonly const class struct interface enum void new return if else for foreach in while do break continue switch case default try catch finally throw this base null true false var out ref where get set private sealed abstract virtual override async await is as typeof".split(" ")),b=new Set("int float bool string double long byte object T Vector3 Quaternion Transform Component GameObject MonoBehaviour Object Stack List Dictionary Func Action IState StateMachine Exception File Path Application JsonUtility Debug Time SaveData SaveSystem ObjectPool Projectile Blaster Enemy PatrolState ChaseState Serializable SerializeField".split(" ")),v=e=>e.replace(/(\/\/\/?[^\n]*)|(\$?"(?:\\.|[^"\\])*")|(\[(?:SerializeField|Serializable)\])|(\b\d+(?:\.\d+)?f?\b)|([A-Za-z_]\w*)|([^\w"\/\[]+|[\s\S])/g,(t,i,n,u,h,o,y)=>i?`<span class="c">${l(i)}</span>`:n?`<span class="s">${l(n)}</span>`:u?`<span class="a">${l(u)}</span>`:h?`<span class="n">${h}</span>`:o?f.has(o)?`<span class="k">${o}</span>`:b.has(o)?`<span class="t">${o}</span>`:o:l(y));let c=0;a.innerHTML=s.map((e,t)=>`<button class="code-tab" role="tab" type="button" id="ct-${e.id}" aria-controls="codePre" aria-selected="${t===0}">${e.file}</button>`).join("");const p=e=>{c=e;const t=s[e];m.innerHTML=v(t.code),r("#codeDesc").textContent=t.t+" \u2014 "+t.d,r("#codePre").setAttribute("aria-labelledby","ct-"+t.id),[...a.children].forEach((i,n)=>{i.setAttribute("aria-selected",n===e),i.tabIndex=n===e?0:-1})};a.onclick=e=>{const t=e.target.closest(".code-tab");t&&p([...a.children].indexOf(t))},a.onkeydown=e=>{if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;const t=(c+(e.key==="ArrowRight"?1:s.length-1))%s.length;p(t),a.children[t].focus()};const d=r("#codeCopy");d.onclick=async()=>{const e=s[c].code;let t=!1;try{await navigator.clipboard.writeText(e),t=!0}catch{const n=document.createElement("textarea");n.value=e,document.body.appendChild(n),n.select();try{t=document.execCommand("copy")}catch{}n.remove()}d.textContent=t?"Copied!":"Copy failed",setTimeout(()=>d.textContent="Copy",1600)},p(0)})();
