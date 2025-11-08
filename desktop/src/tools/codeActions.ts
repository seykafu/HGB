import type { CodeActionInput, ToolResult } from './schema'

export async function proposeCode(input: CodeActionInput): Promise<ToolResult> {
  try {
    const { goal, framework, files } = input

    let code: string
    let checklist: string[] = []

    if (framework === 'unity') {
      code = `// Unity C# MonoBehaviour for NPC Integration
using UnityEngine;
using UnityEngine.AI;
using System.Collections;

public class NPCController : MonoBehaviour
{
    private NavMeshAgent agent;
    
    void Start()
    {
        agent = GetComponent<NavMeshAgent>();
        // Listen for GameBao actions
        StartCoroutine(ListenForActions());
    }
    
    IEnumerator ListenForActions()
    {
        // Check for postMessage events
        // Implement WebSocket or HTTP polling
        yield return null;
    }
    
    public void WalkTo(Vector3 target)
    {
        agent.SetDestination(target);
    }
    
    public void Say(string text)
    {
        // Show dialogue bubble
        Debug.Log($"NPC says: {text}");
    }
}`
      checklist = [
        '1. Add NavMeshAgent component to NPC GameObject',
        '2. Bake NavMesh in your scene (Window > AI > Navigation)',
        '3. Attach this script to your NPC',
        '4. Set up WebSocket connection to ws://localhost:5173/npc',
        '5. Parse incoming actions and call WalkTo() or Say()',
      ]
    } else if (framework === 'unreal') {
      code = `// Unreal C++ Actor for NPC
// NPCController.h
#pragma once
#include "CoreMinimal.h"
#include "AIController.h"
#include "NPCController.generated.h"

UCLASS()
class YOURGAME_API ANPCController : public AAIController
{
    GENERATED_BODY()
    
public:
    void WalkTo(FVector Target);
    void Say(const FString& Text);
};`
      checklist = [
        '1. Create AIController class in Unreal',
        '2. Set up NavMesh bounds volume',
        '3. Create Behavior Tree for NPC wandering',
        '4. Implement WebSocket or HTTP listener',
        '5. Connect to GameBao actions',
      ]
    } else {
      code = `// ${framework} integration guide
// High-level steps for ${framework}:

1. Set up NPC entity/spawn system
2. Configure navigation mesh or pathfinding
3. Create dialogue/UI system
4. Connect to GameBao via WebSocket or HTTP
5. Parse and execute actions from GameBao`
      checklist = [
        '1. Review engine documentation',
        '2. Set up NPC entity system',
        '3. Implement communication bridge',
        '4. Test with GameBao extension',
      ]
    }

    return {
      ok: true,
      data: {
        code,
        checklist,
        framework,
        files: files || [],
      },
      message: `Code proposal for ${framework}`,
    }
  } catch (error) {
    return {
      ok: false,
      message: `Failed to generate code: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

export async function outputSnippets(input: CodeActionInput): Promise<ToolResult> {
  // Similar to proposeCode but returns just the code snippet without diff format
  return proposeCode(input)
}

